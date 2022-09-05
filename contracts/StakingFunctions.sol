// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./StakingData.sol";
import "./priceSetter.sol";
import "./TimeLibrary.sol";

// Import this file to use console.log
import "hardhat/console.sol";

contract StakingFunctions is Ownable {
    using SafeMath for uint256;
    using SafeMath for uint128;
    using BokkyPooBahsDateTimeLibrary for uint32;

    priceSetter ps;
    StakingData sd;
    IERC20 OPCO;
    IERC20 BUSD;
    address OPCOAdress;
    address BUSDAdress;
    address DataAddress;
    address StoreAddress;


    constructor(
        address _priceSetter,
        address _StakingData,
        address _OPCO,
        address _BUSD,
        address _store
    ) {
        ps = priceSetter(_priceSetter);
        sd = StakingData(_StakingData);
        OPCO = IERC20(_OPCO);
        BUSD = IERC20(_BUSD);
        DataAddress = _StakingData;
        OPCOAdress = _OPCO;
        BUSDAdress = _BUSD;
        StoreAddress = _store;
    }

    event newPool(uint16 pool);
    event modifyPool(uint16 pool);
    event newUserStake(uint16 id);
    event modifyUser(uint16 poolId);
    event userCancelStake(uint16 id);

    function getTokenPrice() public view returns (uint256 price) {
        return ps.fetchPrice();
    }

   

    // pool functions --------------------------------------------------------------------------

    function setNewPool(
        uint128 _maxPerWallet,
        uint128 _maxPerPool,
        uint128 _stakeApr,
        uint32 _tokenLoketTime,
        uint8 _choiceReward
    ) public onlyOwner {
        require(
            _choiceReward >= 0 && _choiceReward <= 1,
            "choice a valid option"
        );

        sd.pushPoolData(
            _maxPerWallet,
            _maxPerPool,
            _stakeApr,
            _tokenLoketTime,
            _choiceReward
        );
        emit newPool(uint16(sd.poolDataLength()));
    }

    // user function --------------------------------------------------------------------------

    function setUserStake(
        uint16 _poolId,
        uint128 _stakedTokens
    ) public {
        require(OPCO.balanceOf(msg.sender) >= _stakedTokens,"unsuficient user balance");
        (uint128 maxPerWallet,,,uint32 lockedTIme,,,,bool active) = sd.poolData(_poolId);
        require(active == true, "pool not active");

        require(maxPerWallet >= _stakedTokens*10**10, "address reach the limit");
  
        require(calculateStakeTotal(_poolId, _stakedTokens*10**10)==true, "Pool reach the limit");
        require(oneAddressPerPool(_poolId, msg.sender) == true, "you are already in pool");

        uint128 tokenPrice = uint128(getTokenPrice());
        sd.pushUserData(
            msg.sender,
            _stakedTokens*10**10,
            tokenPrice,
            uint32(block.timestamp + lockedTIme),
            _poolId
        );
        OPCO.transferFrom(msg.sender, DataAddress, _stakedTokens);
        emit newUserStake(uint16(sd.userDataLength()));
    }

    function userClaimReward(uint16 _userId, uint8 _option) public {
        (address owner,uint128 tokenPrice,uint128 tokensToReestake,uint128 stakedTokens,uint128 rewardedAmount,,,,uint16 poolId,,bool activeUser) = sd.userData(_userId);
        (,,,,,,uint8 choice,bool active)=sd.poolData(poolId);
        
        require(msg.sender == owner, "you must be the owner");
        require(validClaimDate(_userId) == true, "Not valid date for claim");
        require(active == true, "pool not active");
        require(activeUser == true, "user not active");
        require(_option > 0 && _option <= 2, "set a valid option");

        uint256 reward = calculateReward(_userId);

        if(_option == 1 && choice == 0){
            sd.manageBalance(msg.sender, OPCOAdress, reward/10**10);
            sd.modifyUserDataStakedTokens(_userId, stakedTokens + tokensToReestake);
            }
       
        if(_option == 1 && choice == 1){
            sd.manageBalance(msg.sender, BUSDAdress, reward*tokenPrice/10**18);
             sd.modifyUserDataStakedTokens(_userId, stakedTokens + tokensToReestake);
            }


        if(_option == 2 && choice == 0 ||_option == 2 && choice == 1){
            sd.modifyUserDataStakedTokens(_userId, uint128(stakedTokens + reward + tokensToReestake));
        }
      
        
        sd.modifyUserDataTokensToReestake(_userId, 0);
        sd.modifyUserDataDateClaimed(_userId, uint32(block.timestamp));
        sd.modifyUserDataRewardedAmount(_userId, uint128(rewardedAmount + reward));

        emit modifyUser(_userId);
    }

    function stakeMoreTokens(uint16 _userId, uint128 _amount)public{
        (address owner,,uint128 tokensToReestake,uint128 stakedTokens,,,,,uint16 poolId,,bool activeUser) = sd.userData(_userId);
        (uint128 maxPerWallet,,,,,,,bool active) = sd.poolData(poolId);

        
        require(owner == msg.sender, "you are not the owner");
        require(OPCO.balanceOf(msg.sender) >= _amount ,"dont have enought balance");
        require(activeUser== true,"user not active");
        require(active== true,"user not active");
        require(stakedTokens + _amount*10**10 <= maxPerWallet, "wallet stake limit");

        sd.modifyUserDataTokensToReestake( _userId,tokensToReestake + _amount*10**10);
        emit modifyUser(_userId);
    } 

    function userUnstake(uint16 _userId) public {
        (address owner,,uint256 tokensToReestake,uint256 stakedTokens,,,,uint32 tokensLockedTime,,,bool activeUser) = sd.userData(_userId);
        require(msg.sender == owner, "You must be the owner");
        require(tokensLockedTime <= block.timestamp,"you must wait the unlock date");
        console.log("tokens Locked Time", tokensLockedTime);
        console.log("actual time",block.timestamp);
        require(activeUser == true, "user not active");

        sd.manageBalance(msg.sender,OPCOAdress,(stakedTokens + tokensToReestake)/10**10);
        sd.modifyUserDataActiveUser(_userId, false);
        sd.modifyUserDataStakedTokens(_userId, 0);
        sd.modifyUserDataTokensToReestake(_userId, 0);
    }

    function buyOnStore(uint16 _id ,uint128 _amount) public {
        (address owner,,,uint128 stakedTokens,,,,,,,)=sd.userData(_id);
        require(owner == msg.sender, "you are not the owner");
        require(stakedTokens >= _amount*10**10,"dont have enougth tokens in stake");

        sd.manageBalance(StoreAddress, OPCOAdress, _amount);
        sd.modifyUserDataStakedTokens(_id, stakedTokens-_amount*10**10);
        emit modifyUser(_id);
    }

    // private methods ------------------------

    function calculateReward(uint16 _userId)
        private
        view
        returns (uint256 _reward)
    {
        (,,,uint128 stakedTokens,uint128 rewardedAmount,uint32 startTime,,,uint16 poolId,,
        ) = sd.userData(_userId);

        (,,uint128 stakeApr,,,,,)=sd.poolData(poolId);

        uint256 aprPerSecond = uint256(stakeApr) / 365 / 24 / 60 / 60;
      
        uint256 timePassed = block.timestamp - uint256(startTime);

        uint256 completeAPR = (timePassed * aprPerSecond)/10**16;
  
        uint256 reward = completeAPR * uint256(stakedTokens);

        uint256 toClaim = (reward/10**4) - uint256(rewardedAmount);
    
        return toClaim;
    }


    function validClaimDate(uint16 userId)
        private
        view
        returns (bool validDate)
    {
        (,,,,,,uint32 dateClaimed,,,,) = sd.userData(userId);

        (uint256 year,uint256 month,) = dateClaimed.timestampToDate();
        (uint256 claimYear,uint256 claimMonth,) = uint32(block.timestamp).timestampToDate();

        if(month == claimMonth){
            if(year == claimYear){validDate = false;}
            if(year != claimYear){validDate = true;}
        }
        if(month != claimMonth){validDate = true;}

        return validDate;
    }

    function calculateStakeTotal(uint16 _poolId, uint128 _amount) private view returns(bool admit){
    (, uint128 maxPerPool,,,,,,)=sd.poolData(_poolId);
        uint size =sd.getUserData().length;
        uint128 totalStaket;
        for(uint i; i<size; i++){
            if(sd.getUserData()[i].poolId == _poolId){
            totalStaket += sd.getUserData()[i].stakedTokens;
            }
        }

        if(totalStaket+_amount <= maxPerPool){return admit = true;}
        if(totalStaket+_amount > maxPerPool){return admit = false;}
    } 

    function oneAddressPerPool(uint16 _poolId, address _user) private view returns(bool admit){
         uint size =sd.getUserData().length;
        admit = true; 
            for(uint i; i<size; i++){
            if(sd.getUserData()[i].owner == _user && sd.getUserData()[i].poolId == _poolId && sd.getUserData()[i].activeUser){
                admit = false;
            }
        }
        return admit; 
    }

}
