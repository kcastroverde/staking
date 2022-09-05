// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// Import this file to use console.log
import "hardhat/console.sol";

contract StakingData is Ownable {
    using SafeMath for uint256;

 

    constructor(){
        adminContract[msg.sender] = true;
    }


    struct pools {
        uint128 maxPerWallet;
        uint128 maxPerPool;
        uint128 stakeApr;
        uint32 tokenLoketTime;
        uint32 stakeStartDate;
        uint16 id;
        uint8 choice;
        bool active;
    
    }

    struct data {
        address owner;
        uint128 tokenPrice;
        uint128 tokensToReestake;
        uint128 stakedTokens;
        uint128 rewardedAmount;
        uint32 startTime;
        uint32 dateClaimed;
        uint32 tokensLockedTime;
        uint16 poolId;
        uint16 id;
        bool activeUser;
    }

    pools[] public poolData;
    data[] public userData;

    mapping(address => bool) public adminContract;

    event newPool(uint id);
    event modifyPool(uint id);
    event newUser(uint id);
    event modifyUser(uint id);

    modifier AccessContract() {
        require(adminContract[msg.sender] == true, "not allow to use");
        _;
    }

    function newAdmin(address _admin) public onlyOwner{
        adminContract[_admin] = true;
    }

    function deleteAdmin(address _admin) public onlyOwner{
        adminContract[_admin] = false;
    }

    function poolDataLength() public view returns(uint256){
        return poolData.length;
    }

    function userDataLength() public view returns(uint256){
        return userData.length;
    }

    function getPoolData() public view returns (pools[] memory) {
        return poolData;
    }

    function getUserData() public view returns (data[] memory) {
        return userData;
    }

    function pushPoolData(
        uint128 _maxPerWallet,
        uint128 _maxPerPool,
        uint128 _stakeApr,
        uint32 _tokenLockedTime,
        uint8 _tokenReward
    ) external AccessContract {
  

        pools memory p = pools(
            _maxPerWallet,
            _maxPerPool,
            _stakeApr,
            _tokenLockedTime,
            uint32(block.timestamp),
            uint16(poolData.length),
            _tokenReward,
            true
        );

        poolData.push(p);
        emit newPool(poolData.length);
    }

    function modifyPoolMaxPerWallet(uint16 _poolId, uint128 _maxPerWallet)
        external
        AccessContract
    {
        poolData[_poolId].maxPerWallet = _maxPerWallet;
        emit modifyPool(poolData.length);
    }

    function modifyPoolMaxPerPool(uint16 _poolId, uint128 _maxPerPool)
        external
        AccessContract
    {
        poolData[_poolId].maxPerPool = _maxPerPool;
        emit modifyPool(poolData.length);
    }

    function modifyPoolStakeApr(uint16 _poolId, uint128 _apr)
        external
        AccessContract
    {
        poolData[_poolId].stakeApr = _apr;
        emit modifyPool(poolData.length);
    }

    function modifyTokenLockedTime(uint16 _poolId, uint32 _tokenLockedTime)
        external
        AccessContract
    {
        poolData[_poolId].tokenLoketTime = _tokenLockedTime;
        emit modifyPool(poolData.length);
    }

    function modifyPoolChoice(uint16 _poolId, uint8 _choice)
        external
        AccessContract
        {
            poolData[_poolId].choice = _choice; 
        }

    function pushUserData(
        address _owner,
        uint128 _stakedTokens,
        uint128 _tokenPrice,
        uint32 _tokensLockedTime,
        uint16 _poolId
    ) external AccessContract {
        data memory d = data(
            _owner,
            _tokenPrice,
            0,
            _stakedTokens,
            0,
            uint32(block.timestamp),
            uint32(block.timestamp),
            _tokensLockedTime,
            _poolId,
            uint16(userData.length),
            true
        );

        userData.push(d);
        emit newUser(userData.length);
    }

    function modifyUserDataOwner(uint16 _id, address _owner)
        external
        AccessContract
    {
        userData[_id].owner = _owner;
    }

    function modifyUserDataTokensToReestake(
        uint16 _id,
        uint128 _tokensToReestake
    ) external AccessContract {
        userData[_id].tokensToReestake = _tokensToReestake;
    }

    function modifyUserDataStakedTokens(uint16 _id, uint128 _stakedTokens)
        external
        AccessContract
    {
        userData[_id].stakedTokens = _stakedTokens;
        emit modifyUser(userData.length);
    }


    function modifyUserDataDateClaimed(uint16 _id, uint32 _dateClaimed) external AccessContract{
        userData[_id].dateClaimed = _dateClaimed;
    }

    function modifyUserDataRewardedAmount(uint16 _id, uint128 _rewardedAmount) external AccessContract {
        userData[_id].rewardedAmount = _rewardedAmount;
    }

    function modifyUserDataTokensLockedTime(
        uint16 _id,
        uint32 _tokensLockedTime
    ) external AccessContract {
        userData[_id].tokensLockedTime = _tokensLockedTime;
         emit modifyUser(userData.length);
    }

    function modifyUserDataActiveUser(uint16 _id, bool _active)
        external
        AccessContract
    {
        userData[_id].activeUser = _active;
        emit modifyUser(userData.length);
    }

    function manageBalance(
        address _to,
        address _tokenContract,
        uint256 _amount
    ) external AccessContract {
        IERC20 tokenContract = IERC20(_tokenContract);
        tokenContract.transfer(_to, _amount);
    }

    function withdrawToken(address _tokenContract, uint256 _amount)
        public
        AccessContract
    {
        IERC20 tokenContract = IERC20(_tokenContract);
        tokenContract.transfer(msg.sender, _amount);
    }

    function withdrawBNB() public payable AccessContract {
        payable(msg.sender).transfer(address(this).balance);
    }
}
