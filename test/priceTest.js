const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("staking", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployStaking() {
    const [owner, account1, account2, account3, store] = await ethers.getSigners();

    const busd = await ethers.getContractFactory("BUSD");
    const BUSD = await busd.deploy();

    const opco = await ethers.getContractFactory("Token");
    const OPCO = await opco.deploy("OPCO", "OPCO", 1000, 8, 1000, owner.address)
    
    const tokenPrice = ethers.utils.parseEther('0.12');
    const priceSetter = await ethers.getContractFactory("priceSetter");
    const PRICESETTER_CONTRACT = await priceSetter.deploy(tokenPrice);
  
    const data = await ethers.getContractFactory("StakingData");
    const DATA_CONTRACT = await data.deploy();
   
    const functions = await ethers.getContractFactory("StakingFunctions");
    const FUNCTION_CONTRACT = await functions.deploy(PRICESETTER_CONTRACT.address, DATA_CONTRACT.address, OPCO.address, BUSD.address, store.address);
    await DATA_CONTRACT.newAdmin(FUNCTION_CONTRACT.address)
 
    await BUSD.transfer(DATA_CONTRACT.address, ethers.utils.parseEther('1000'));
    await OPCO.transfer(account1.address, 500*10**8);
    await OPCO.transfer(account2.address, 200*10**8);
    await OPCO.transfer(account3.address, 100*10**8);
  
    

    return {owner, account1, account2, account3, BUSD, OPCO, FUNCTION_CONTRACT, DATA_CONTRACT};
  }

  describe("deployment", function() {
    it("Should deployed correctly", async function(){
      const {FUNCTION_CONTRACT,DATA_CONTRACT, BUSD } = await loadFixture(deployStaking);
      
      const price = await FUNCTION_CONTRACT.getTokenPrice();
      const balance = await BUSD.balanceOf(DATA_CONTRACT.address);
      expect(price).to.equal(ethers.utils.parseEther('0.12'))
      expect(balance).to.equal(ethers.utils.parseEther('1000'))
    })
    it("Should have the correct balance for all accounts", async function(){
      const {OPCO, account1, account2, account3} = await loadFixture(deployStaking);

      const balance1 = await OPCO.balanceOf(account1.address)
      const balance2 = await OPCO.balanceOf(account2.address)
      const balance3 = await OPCO.balanceOf(account3.address)

      expect(balance1).to.equal(500*10**8)
      expect(balance2).to.equal(200*10**8)
      expect(balance3).to.equal(100*10**8)

    })
  })

  describe("user join to pool", function(){ 
    it("Should to add user to id:0 pool", async function(){
      const {FUNCTION_CONTRACT, DATA_CONTRACT, OPCO, account1} = await loadFixture(deployStaking)
      const maxPerWallet = ethers.utils.parseEther('100');
      const maxPerPool = ethers.utils.parseEther('200');
      const APR = ethers.utils.parseEther('365');
      const lockedTime = 7*24*60*60;
      const choice = 0
      await FUNCTION_CONTRACT.setNewPool(maxPerWallet, maxPerPool, APR, lockedTime, choice);
      let pools = await DATA_CONTRACT.getPoolData();
      expect(pools[0].maxPerWallet).to.equal(maxPerWallet);
      expect(pools[0].maxPerPool).to.equal(maxPerPool);
      expect(pools[0].stakeApr).to.equal(APR);
      expect(pools[0].tokenLoketTime).to.equal(lockedTime);
      expect(pools[0].choice).to.equal(choice);
      
      const amount = 100*10**8;
      await OPCO.connect(account1).approve(FUNCTION_CONTRACT.address , amount);
      await FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount)
      const user = await  DATA_CONTRACT.getUserData()

      expect(user.length).to.equal(1)
      expect(await OPCO.balanceOf(account1.address)).to.equal(400*10**8)
      expect(await OPCO.balanceOf(DATA_CONTRACT.address)).to.equal(100*10**8)
    })
    it("Should to manage multiple user staking", async function(){
      const {FUNCTION_CONTRACT, DATA_CONTRACT, OPCO, account1, account2, account3} = await loadFixture(deployStaking)
      const maxPerWallet = ethers.utils.parseEther('300');
      const maxPerPool = ethers.utils.parseEther('500');
      const APR = ethers.utils.parseEther('365');
      const lockedTime = 7*24*60*60;
      const choice = 0
      await FUNCTION_CONTRACT.setNewPool(maxPerWallet, maxPerPool, APR, lockedTime, choice);

      const amount1 = 300*10**8;
      await OPCO.connect(account1).approve(FUNCTION_CONTRACT.address , amount1);
      await FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount1)

      const amount2 = 100*10**8;
      await OPCO.connect(account2).approve(FUNCTION_CONTRACT.address , amount2);
      await FUNCTION_CONTRACT.connect(account2).setUserStake(0 ,amount2)

      const amount3 = 100*10**8;
      await OPCO.connect(account3).approve(FUNCTION_CONTRACT.address , amount3);
      await FUNCTION_CONTRACT.connect(account3).setUserStake(0 ,amount3)

      expect(await OPCO.balanceOf(account1.address)).to.equal(200*10**8);
      expect(await OPCO.balanceOf(account2.address)).to.equal(100*10**8);
      expect(await OPCO.balanceOf(account3.address)).to.equal(0);
      expect(await OPCO.balanceOf(DATA_CONTRACT.address)).to.equal(500*10**8);

    })
    
    it("Should to fail if require are brookes", async function(){
      const {FUNCTION_CONTRACT, DATA_CONTRACT, OPCO, account1, account2, account3} = await loadFixture(deployStaking)
      const maxPerWallet = ethers.utils.parseEther('100');
      const maxPerPool = ethers.utils.parseEther('200');
      const APR = ethers.utils.parseEther('365');
      const lockedTime = 7*24*60*60;
      const choice = 0
      await FUNCTION_CONTRACT.setNewPool(maxPerWallet, maxPerPool, APR, lockedTime, choice);

      const amount1 = 300*10**8;
      const amount1_1 = 100*10**8;
      await OPCO.connect(account1).approve(FUNCTION_CONTRACT.address , amount1);
      await expect(FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount1)).to.be.revertedWith("address reach the limit");
      
      await FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount1_1);
  
      const amount2 = 100*10**8;
      await OPCO.connect(account2).approve(FUNCTION_CONTRACT.address , amount2);
      await FUNCTION_CONTRACT.connect(account2).setUserStake(0 ,amount2)
   
      const amount3 = 100*10**8;
      await OPCO.connect(account3).approve(FUNCTION_CONTRACT.address , amount3);
      await expect(FUNCTION_CONTRACT.connect(account3).setUserStake(0 ,amount3)).to.be.revertedWith("Pool reach the limit");

      expect(await OPCO.balanceOf(account1.address)).to.equal(400*10**8);
      expect(await OPCO.balanceOf(account2.address)).to.equal(100*10**8);
      expect(await OPCO.balanceOf(account3.address)).to.equal(100*10**8);
      expect(await OPCO.balanceOf(DATA_CONTRACT.address)).to.equal(200*10**8);
    })

    it("Should fail if the same address enter at the same pool twice", async function(){
      const {FUNCTION_CONTRACT, DATA_CONTRACT, OPCO, account1, account2, account3} = await loadFixture(deployStaking)
      const maxPerWallet = ethers.utils.parseEther('500');
      const maxPerPool = ethers.utils.parseEther('500');
      const APR = ethers.utils.parseEther('365');
      const lockedTime = 7*24*60*60;
      const choice = 0
      await FUNCTION_CONTRACT.setNewPool(maxPerWallet, maxPerPool, APR, lockedTime, choice);

      const amount1 = 300*10**8;
      const amount2 = 200*10**8;
      await OPCO.connect(account1).approve(FUNCTION_CONTRACT.address , amount1);
      await FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount1)

      await expect(FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount2)).to.be.revertedWith("you are already in pool")
    })

    it("Should to modify user by the owner", async function(){
      const {FUNCTION_CONTRACT, DATA_CONTRACT, OPCO, account1, account2} = await loadFixture(deployStaking)
      const maxPerWallet = ethers.utils.parseEther('100');
      const maxPerPool = ethers.utils.parseEther('200');
      const APR = ethers.utils.parseEther('365');
      const lockedTime = 7*24*60*60;
      const choice = 0
      await FUNCTION_CONTRACT.setNewPool(maxPerWallet, maxPerPool, APR, lockedTime, choice);
      
      const amount = 100*10**8;
      await OPCO.connect(account1).approve(FUNCTION_CONTRACT.address , amount);
      await FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount)
      let user = await  DATA_CONTRACT.getUserData()

      expect(user[0].owner).to.equal(account1.address)
      expect(user[0].tokenPrice).to.equal(ethers.utils.parseEther('0.12'))
      expect(user[0].stakedTokens).to.equal(ethers.utils.parseEther('100'))
    

      const amount2 = ethers.utils.parseEther('50')
      await DATA_CONTRACT.modifyUserDataOwner(0, account2.address);
      await DATA_CONTRACT.modifyUserDataStakedTokens(0, amount2)
      await DATA_CONTRACT.modifyUserDataTokensLockedTime(0, 0);
      await DATA_CONTRACT.modifyUserDataActiveUser(0 , false);
      
      user = await  DATA_CONTRACT.getUserData()
      expect(user[0].owner).to.equal(account2.address)
      expect(user[0].stakedTokens).to.equal(ethers.utils.parseEther('50'))
      expect(user[0].tokensLockedTime).to.equal(0)
      expect(user[0].activeUser).to.equal(false)

    })
  })

  describe("claim reward", function(){
    it("Should return de entire reward in one year", async function(){
      const {FUNCTION_CONTRACT, DATA_CONTRACT, OPCO, account1, account2} = await loadFixture(deployStaking)
      const maxPerWallet = ethers.utils.parseEther('100');
      const maxPerPool = ethers.utils.parseEther('200');
      const APR = ethers.utils.parseEther('100');
      const lockedTime = 7*24*60*60;
      const choice = 0
      await FUNCTION_CONTRACT.setNewPool(maxPerWallet, maxPerPool, APR, lockedTime, choice);

      const amount = 100*10**8;
      await OPCO.connect(account1).approve(FUNCTION_CONTRACT.address , amount);
      await FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount)

      const amount2 = 95.5*10**8;
      await OPCO.connect(account2).approve(FUNCTION_CONTRACT.address , amount);
      await FUNCTION_CONTRACT.connect(account2).setUserStake(0 ,amount2)


      await network.provider.send("evm_increaseTime", [365*24*60*60]);
      await network.provider.send("evm_mine");

      await FUNCTION_CONTRACT.connect(account1).userClaimReward(0, 1)
      await FUNCTION_CONTRACT.connect(account2).userClaimReward(1, 1)


      expect(await OPCO.balanceOf(account1.address)).to.equal(500*10**8)
      expect(await OPCO.balanceOf(account2.address)).to.equal(200*10**8)
      expect(await OPCO.balanceOf(FUNCTION_CONTRACT.address)).to.equal(0);
    })
    it("Shoul claim only one time at month", async function(){
      const {FUNCTION_CONTRACT, DATA_CONTRACT, OPCO, account1, account2} = await loadFixture(deployStaking)
      const maxPerWallet = ethers.utils.parseEther('100');
      const maxPerPool = ethers.utils.parseEther('200');
      const APR = ethers.utils.parseEther('100');
      const lockedTime = 7*24*60*60;
      const choice = 0
      await FUNCTION_CONTRACT.setNewPool(maxPerWallet, maxPerPool, APR, lockedTime, choice);

      const amount = 100*10**8;
      await OPCO.connect(account1).approve(FUNCTION_CONTRACT.address , amount);
      await FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount)
      await expect(FUNCTION_CONTRACT.connect(account1).userClaimReward(0, 1)).to.be.rejectedWith("Not valid date for claim");

      
      await network.provider.send("evm_increaseTime", [30*24*60*60]);
      await network.provider.send("evm_mine");

      await FUNCTION_CONTRACT.connect(account1).userClaimReward(0, 1);
      expect(await OPCO.balanceOf(account1.address)).to.equal(408.21*10**8);
    })

    it("Should to claim in BUSD if pool is a BUSD Reward", async function(){
      const {FUNCTION_CONTRACT, DATA_CONTRACT, OPCO,BUSD, account1, account2} = await loadFixture(deployStaking)
      const maxPerWallet = ethers.utils.parseEther('100');
      const maxPerPool = ethers.utils.parseEther('200');
      const APR = ethers.utils.parseEther('100');
      const lockedTime = 7*24*60*60;
      const choice = 1
      await FUNCTION_CONTRACT.setNewPool(maxPerWallet, maxPerPool, APR, lockedTime, choice);

      const amount = 100*10**8;
      await OPCO.connect(account1).approve(FUNCTION_CONTRACT.address , amount);
      await FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount)
      await expect(FUNCTION_CONTRACT.connect(account1).userClaimReward(0, 1)).to.be.rejectedWith("Not valid date for claim");

      await network.provider.send("evm_increaseTime", [30*24*60*60]);
      await network.provider.send("evm_mine");

      await FUNCTION_CONTRACT.connect(account1).userClaimReward(0, 1);
      expect(await BUSD.balanceOf(account1.address)).to.equal(ethers.utils.parseEther('0.9852'))
    })
    it("Should have a error if claim in the same month ",async function(){
      const {FUNCTION_CONTRACT, DATA_CONTRACT, OPCO,BUSD, account1, account2} = await loadFixture(deployStaking)
      const maxPerWallet = ethers.utils.parseEther('200');
      const maxPerPool = ethers.utils.parseEther('200');
      const APR = ethers.utils.parseEther('100');
      const lockedTime = 7*24*60*60;
      const choice = 0
      await FUNCTION_CONTRACT.setNewPool(maxPerWallet, maxPerPool, APR, lockedTime, choice);

      const amount = 100*10**8;
      await OPCO.connect(account1).approve(FUNCTION_CONTRACT.address , amount);
      await FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount)

      await network.provider.send("evm_increaseTime", [1*24*60*60]);
      await network.provider.send("evm_mine");

      await expect(FUNCTION_CONTRACT.connect(account1).userClaimReward(0, 1)).to.be.rejectedWith("Not valid date for claim");
    })
  })

  describe("reesetake", function(){
    it("Should be able to reestake the reward",async function(){
      const {FUNCTION_CONTRACT, DATA_CONTRACT, OPCO,BUSD, account1, account2} = await loadFixture(deployStaking)
      const maxPerWallet = ethers.utils.parseEther('100');
      const maxPerPool = ethers.utils.parseEther('200');
      const APR = ethers.utils.parseEther('100');
      const lockedTime = 7*24*60*60;
      const choice = 0
      await FUNCTION_CONTRACT.setNewPool(maxPerWallet, maxPerPool, APR, lockedTime, choice);

      const amount = 100*10**8;
      await OPCO.connect(account1).approve(FUNCTION_CONTRACT.address , amount);
      await FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount)

      let users =  await DATA_CONTRACT.getUserData()

      expect(users[0].stakedTokens).to.equal(ethers.utils.parseEther('100'))

      await network.provider.send("evm_increaseTime", [30*24*60*60]);
      await network.provider.send("evm_mine");

      await FUNCTION_CONTRACT.connect(account1).userClaimReward(0, 2);

      users = await DATA_CONTRACT.getUserData();

      expect(users[0].stakedTokens).to.equal(ethers.utils.parseEther('108.21'));
    
    })

    it("Should to stake more token and add to staked tokens at the next month",async function(){
      const {FUNCTION_CONTRACT, DATA_CONTRACT, OPCO,BUSD, account1, account2} = await loadFixture(deployStaking)
      const maxPerWallet = ethers.utils.parseEther('200');
      const maxPerPool = ethers.utils.parseEther('200');
      const APR = ethers.utils.parseEther('100');
      const lockedTime = 7*24*60*60;
      const choice = 0
      await FUNCTION_CONTRACT.setNewPool(maxPerWallet, maxPerPool, APR, lockedTime, choice);

      const amount = 100*10**8;
      await OPCO.connect(account1).approve(FUNCTION_CONTRACT.address , amount);
      await FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount)

      let users =  await DATA_CONTRACT.getUserData()

      expect(users[0].stakedTokens).to.equal(ethers.utils.parseEther('100'))

      await FUNCTION_CONTRACT.connect(account1).stakeMoreTokens(0, amount);

      users =  await DATA_CONTRACT.getUserData()

      expect(users[0].tokensToReestake).to.equal(ethers.utils.parseEther('100'))

      await network.provider.send("evm_increaseTime", [30*24*60*60]);
      await network.provider.send("evm_mine");

      
      await FUNCTION_CONTRACT.connect(account1).userClaimReward(0, 1);
      users =  await DATA_CONTRACT.getUserData()

      expect(users[0].tokensToReestake).to.equal(ethers.utils.parseEther('0'))
      expect(users[0].stakedTokens).to.equal(ethers.utils.parseEther('200'))

    })

  })

  describe("Unstake tokens", function(){
    it("Should to unstake tokens when the time of unstake come", async function(){
      const {FUNCTION_CONTRACT, DATA_CONTRACT, OPCO,BUSD, account1, account2} = await loadFixture(deployStaking)
      const maxPerWallet = ethers.utils.parseEther('200');
      const maxPerPool = ethers.utils.parseEther('200');
      const APR = ethers.utils.parseEther('100');
      const lockedTime = 30*24*60*60;
      const choice = 0
      await FUNCTION_CONTRACT.setNewPool(maxPerWallet, maxPerPool, APR, lockedTime, choice);

      const amount = 100*10**8;
      await OPCO.connect(account1).approve(FUNCTION_CONTRACT.address , amount);
      await FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount)

      await expect(FUNCTION_CONTRACT.connect(account1).userUnstake(0)).to.be.rejectedWith("you must wait the unlock date")
      
      await network.provider.send("evm_increaseTime", [31*24*60*60]);
      await network.provider.send("evm_mine");

      await FUNCTION_CONTRACT.connect(account1).userUnstake(0)

      const users =  await DATA_CONTRACT.getUserData()

      expect(users[0].activeUser).to.equal(false)
      expect(users[0].stakedTokens).to.equal(0)

      expect(await OPCO.balanceOf(account1.address)).to.equal(500*10**8)
    })
  })

  describe("Buy on store with staked tokens", function(){
    it("Should to buy on store with the staked balance", async function(){
      const {FUNCTION_CONTRACT, DATA_CONTRACT, OPCO,BUSD, account1, account2} = await loadFixture(deployStaking)
      const maxPerWallet = ethers.utils.parseEther('200');
      const maxPerPool = ethers.utils.parseEther('200');
      const APR = ethers.utils.parseEther('100');
      const lockedTime = 30*24*60*60;
      const choice = 0
      await FUNCTION_CONTRACT.setNewPool(maxPerWallet, maxPerPool, APR, lockedTime, choice);

      const amount = 100*10**8;
      await OPCO.connect(account1).approve(FUNCTION_CONTRACT.address , amount);
      await FUNCTION_CONTRACT.connect(account1).setUserStake(0 ,amount)

      let users =  await DATA_CONTRACT.getUserData()
      expect(users[0].stakedTokens).to.equal(ethers.utils.parseEther('100'))

      const amountForBuy = 50*10**8
      await FUNCTION_CONTRACT.connect(account1).buyOnStore(0,amountForBuy)

      users =  await DATA_CONTRACT.getUserData()
      expect(users[0].stakedTokens).to.equal(ethers.utils.parseEther('50'))

    })

  })



  

});
