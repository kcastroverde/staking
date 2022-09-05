// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract priceSetter is Ownable{


    uint256 public price; 

    constructor (uint256 _price) {
        price = _price;
    }

    function fetchPrice() public view returns(uint256){
        return price; 
    }

    function newPrice(uint256 _price) public onlyOwner {
        price = _price;
    }

    function withdrawToken(address _tokenContract, uint256 _amount) external onlyOwner{
        IERC20 tokenContract = IERC20(_tokenContract);
        tokenContract.transfer(msg.sender, _amount);
    }

    function withdrawBNB() public payable onlyOwner{
    payable(msg.sender).transfer(address(this).balance);
    }
    
}