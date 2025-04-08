import React, { useState, useEffect } from 'react';
import { ConnectButton } from "thirdweb/react";
import { client } from "./client";
import { ethers } from "ethers";

const presaleAbi = [
  "function buyTokens(address referrer) public payable",
  "function claimReferralRewards() external",
  "function referralRewards(address) external view returns (uint256)",
  "function withdrawBNB() external",
  "function withdrawTokens(uint256 amount) external", 
  "function getOwner() external view returns (address)",
  "function getTransactionHistory() external view returns (tuple(address buyer, uint256 amount, address referrer, uint256 refBonus)[] memory)",
  "function balanceOf(address) external view returns (uint256)", 
  "function token() external view returns (address)",
  "event TokensPurchased(address indexed buyer, uint256 amount, address indexed referrer, uint256 refBonus)",
  "event TokensWithdrawn(address indexed admin, uint256 amount)",
  "event ReferralRewardClaimed(address indexed referrer, uint256 amount)"
];

export function App() {
  // IMPORTANT: Update this with your actual contract address
  const contractAddress = "0xcA221d0dfcD0476522c74003fEf0902Bf36B6B6F"; 
  
  // State variables
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [referrer, setReferrer] = useState('');
  const [bnbAmount, setBnbAmount] = useState('0.036');
  const [status, setStatus] = useState('');
  const [referralReward, setReferralReward] = useState('0');
  const [isAdmin, setIsAdmin] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [withdrawalEvents, setWithdrawalEvents] = useState([]);
  const [contractBnbBalance, setContractBnbBalance] = useState('0');
  const [contractTokenBalance, setContractTokenBalance] = useState('0');
  const [tokenWithdrawAmount, setTokenWithdrawAmount] = useState('0');
  const [tokenAddress, setTokenAddress] = useState('0x1C9E9Ef4855a93DeaB5eBe1e5259919B32AF217e');
  const [showPresale, setShowPresale] = useState(true); // Always show the UI
  const [connectionStatus, setConnectionStatus] = useState('Waiting for wallet connection');
  const [debugInfo, setDebugInfo] = useState({});

  // List of admin addresses
  const adminAddresses = [
    '0x8398e0B8e173e45c7AD14E5c35e37F4512F05a7f',
    '0xE2F2D38Ac24918b2d56bB8FdD8291F2b60B76A7f',
    '0xAdminAddress3',
  ];

  // Check if the wallet is already connected when the component mounts
  useEffect(() => {
    const checkExistingConnection = async () => {
      try {
        if (window.ethereum) {
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          const accounts = await web3Provider.listAccounts();
          
          if (accounts.length > 0) {
            setConnectionStatus('Found existing connection...');
            setAccount(accounts[0]);
            setProvider(web3Provider);
            await setupContract(web3Provider, accounts[0]);
          }
        }
      } catch (err) {
        console.error("Error checking existing connection:", err);
      }
    };
    
    checkExistingConnection();
  }, []);

  // Function to set up contract when wallet is connected
  const setupContract = async (provider, address) => {
	try {
	  setConnectionStatus('Setting up contract...');
	  console.log("Setting up contract for address:", address);
	  
	  const signer = provider.getSigner();
	  setSigner(signer);
	  
	  // Create contract instance
	  const presaleContract = new ethers.Contract(contractAddress, presaleAbi, signer);
	  setContract(presaleContract);
	  setConnectionStatus('Contract connected successfully');
	  
	  // Debug info
	  setDebugInfo({
		contractAddress,
		signerAddress: await signer.getAddress(),
		contractObject: presaleContract ? "Created" : "Failed"
	  });
	  
	  // Get user's referral rewards
	  try {
		const reward = await presaleContract.referralRewards(address);
		setReferralReward(ethers.utils.formatEther(reward));
	  } catch (err) {
		console.error("Error getting referral rewards:", err);
		setStatus("Failed to get referral rewards: " + (err.reason || err.message));
	  }
	  
	  // Improved admin check with better logging
	  const userAddressLower = address.toLowerCase();
	  const adminAddressesLower = adminAddresses.map(addr => addr.toLowerCase());
	  const isCurrentAdmin = adminAddressesLower.includes(userAddressLower);
	  
	  console.log("Admin check:", {
		userAddress: userAddressLower,
		isAdmin: isCurrentAdmin,
		adminAddresses: adminAddressesLower
	  });
	  
	  setIsAdmin(isCurrentAdmin);
	  
	  // Only fetch admin data if the user is an admin
	  if (isCurrentAdmin) {
		fetchContractBalances(provider, contractAddress);
		fetchTransactionHistory(presaleContract);
		setupEventListeners(presaleContract, provider);
	  }
	  
	} catch (err) {
	  console.error("Error setting up contract:", err);
	  setConnectionStatus("Failed to set up contract: " + (err.message || "Unknown error"));
	}
  };
  
  // Function to handle ThirdWeb wallet connection
  const handleWalletConnected = async (walletInfo) => {
    try {
      setConnectionStatus('Wallet connected, processing...');
      console.log("Wallet connected:", walletInfo);
      
      if (walletInfo && walletInfo.provider) {
        // Create ethers provider from the web3 provider
        const ethersProvider = new ethers.providers.Web3Provider(walletInfo.provider);
        setProvider(ethersProvider);
        
        // Get accounts
        const accounts = await ethersProvider.listAccounts();
        console.log("Accounts:", accounts);
        
        if (accounts.length > 0) {
          const userAddress = accounts[0];
          setAccount(userAddress);
          setConnectionStatus('Account detected: ' + userAddress);
          
          // Setup contract with the connected wallet
          await setupContract(ethersProvider, userAddress);
        } else {
          setConnectionStatus('No accounts found after connection');
        }
      } else {
        setConnectionStatus('Wallet connected but no provider available');
      }
    } catch (err) {
      console.error("Error in handleWalletConnected:", err);
      setConnectionStatus('Connection error: ' + (err.message || "Unknown error"));
    }
  };

  // Set up event listeners for contract events
  const setupEventListeners = (presaleContract, provider) => {
    // Listen for purchase events
    presaleContract.on("TokensPurchased", (buyer, amount, referrer, refBonus, event) => {
      console.log("Purchase event detected:", { buyer, amount, referrer, refBonus });
      
      const refBonusFormatted = referrer === "0x0000000000000000000000000000000000000000" 
        ? "0" 
        : ethers.utils.formatEther(refBonus);
    
      const newTransaction = {
        buyer,
        amount: ethers.utils.formatEther(amount),
        referrer,
        refBonus: refBonus === "0x0000000000000000000000000000000000000000" 
          ? "0" 
          : refBonusFormatted,
        type: "purchase",
        timestamp: new Date().toLocaleString()
      };
    
      setTransactions(prevTransactions => [...prevTransactions, newTransaction]);
      fetchContractBalances(provider, contractAddress);
    });
    
    // Listen for withdrawal events
    presaleContract.on("TokensWithdrawn", (admin, amount, event) => {
      console.log("Withdrawal event detected:", { admin, amount: ethers.utils.formatEther(amount) });
      
      const newWithdrawal = {
        admin,
        amount: ethers.utils.formatEther(amount),
        timestamp: new Date().toLocaleString(),
        type: "withdrawal",
        transactionHash: event.transactionHash
      };
      
      setWithdrawalEvents(prevEvents => [...prevEvents, newWithdrawal]);
      fetchContractBalances(provider, contractAddress);
    });
    
    // Listen for referral claim events
    presaleContract.on("ReferralRewardClaimed", (referrer, amount, event) => {
      console.log("Referral claim event detected:", { referrer, amount });
      
      const newClaim = {
        referrer,
        amount: ethers.utils.formatEther(amount),
        timestamp: new Date().toLocaleString(),
        type: "referralClaim",
        transactionHash: event.transactionHash
      };
      
      setWithdrawalEvents(prevEvents => [...prevEvents, newClaim]);
      fetchContractBalances(provider, contractAddress);
    });
  };

  const fetchContractBalances = async (provider, contractAddress) => {
    try {
      if (!provider || !contractAddress) return;
  
      // Fetch BNB balance of the presale contract
      const bnbBalance = await provider.getBalance(contractAddress);
      console.log("BNB Balance in presale contract:", ethers.utils.formatEther(bnbBalance));
      setContractBnbBalance(ethers.utils.formatEther(bnbBalance));
  
      // Use your hardcoded token address instead of fetching from contract
      if (tokenAddress) {
        const erc20Abi = [
          "function balanceOf(address account) external view returns (uint256)"
        ];
        
        const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
        const tokenBalance = await tokenContract.balanceOf(contractAddress);
        console.log("Token Balance in presale contract:", ethers.utils.formatUnits(tokenBalance, 18));
        setContractTokenBalance(ethers.utils.formatUnits(tokenBalance, 18));
      }
    } catch (err) {
      console.error("Error fetching contract balances:", err);
    }
  };
  
  const fetchTransactionHistory = async (presaleContract) => {
    try {
      if (!presaleContract) return;
      
      const txHistory = await presaleContract.getTransactionHistory();
      
      const formattedHistory = txHistory.map(tx => ({
        buyer: tx.buyer,
        amount: ethers.utils.formatEther(tx.amount),
        referrer: tx.referrer,
        refBonus: tx.referrer === "0x0000000000000000000000000000000000000000" 
          ? "0" 
          : ethers.utils.formatEther(tx.refBonus),
        type: "purchase"
      }));
      
      setTransactions(formattedHistory);
    } catch (err) {
      console.error("Error fetching transaction history:", err);
    }
  };

  const handleBuy = async () => {
    try {
      if (!contract) {
        console.error("Contract not initialized");
        setStatus("Please connect your wallet first");
        return;
      }
      
      if (!account) {
        console.error("No account connected");
        setStatus("Please connect your wallet first");
        return;
      }
      
      console.log("Buying tokens with params:", {
        account,
        referrer: referrer || "0x0000000000000000000000000000000000000000",
        amount: bnbAmount
      });
      
      const ref = referrer || "0x0000000000000000000000000000000000000000"; // Default to zero address if empty
      const tx = await contract.buyTokens(ref, {
        value: ethers.utils.parseEther(bnbAmount),
      });
      setStatus("Transaction sent. Waiting for confirmation...");
      
      console.log("Transaction hash:", tx.hash);
      
      await tx.wait();
      setStatus("Token purchase successful!");
      
      // Update referral rewards after purchase
      if (account) {
        const reward = await contract.referralRewards(account);
        setReferralReward(ethers.utils.formatEther(reward));
      }
    } catch (err) {
      console.error("Purchase error:", err);
      setStatus("Purchase failed: " + (err.reason || err.message || "Unknown error"));
    }
  };

  const handleClaimReferral = async () => {
    try {
      if (!contract) {
        setStatus("Please connect your wallet first");
        return;
      }
      
      const tx = await contract.claimReferralRewards();
      setStatus("Claiming referral rewards...");
      await tx.wait();
      setStatus("Referral rewards claimed successfully!");

      // After claiming, update the referral reward in the UI
      const updatedReward = await contract.referralRewards(account);
      setReferralReward(ethers.utils.formatEther(updatedReward));
    } catch (err) {
      console.error(err);
      setStatus("Claim failed: " + (err.reason || err.message || "Unknown error"));
    }
  };

  const handleWithdrawBNB = async () => {
    try {
      if (!contract) {
        setStatus("Please connect your wallet first");
        return;
      }
      
      const tx = await contract.withdrawBNB();
      setStatus("Withdrawal in process...");
      await tx.wait();
      setStatus("BNB withdrawn successfully!");
      fetchContractBalances(provider, contractAddress); // Refresh balances
    } catch (err) {
      console.error(err);
      setStatus("Withdrawal failed: " + (err.reason || err.message || "Unknown error"));
    }
  };

  const handleWithdrawTokens = async () => {
    try {
      if (!contract) {
        setStatus("Please connect your wallet first");
        return;
      }
      
      const amount = ethers.utils.parseUnits(tokenWithdrawAmount, 18); // Assuming 18 decimals
      const tx = await contract.withdrawTokens(amount);
      setStatus("Token withdrawal in process...");
      await tx.wait();
      setStatus("Tokens withdrawn successfully!");
      fetchContractBalances(provider, contractAddress); // Refresh balances
    } catch (err) {
      console.error(err);
      setStatus("Token withdrawal failed: " + (err.reason || err.message || "Unknown error"));
    }
  };

  // Manual wallet connect function as a backup
  const connectWalletManually = async () => {
    try {
      // Check if MetaMask is installed
      if (window.ethereum) {
        setConnectionStatus('Requesting accounts...');
        
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Create provider
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(provider);
        
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setConnectionStatus('Connected manually: ' + accounts[0]);
          await setupContract(provider, accounts[0]);
        }
      } else {
        setConnectionStatus('MetaMask not found. Please install MetaMask.');
      }
    } catch (err) {
      console.error("Manual connection error:", err);
      setConnectionStatus('Manual connection failed: ' + err.message);
    }
  };

  return (
    <main className="p-4 pb-10 min-h-[100vh] flex items-center justify-center container max-w-screen-lg mx-auto">
      <div className="py-20 w-full">
        <Header />

        <div className="flex justify-center mb-8">
          <ConnectButton
            client={client}
            appMetadata={{
              name: "Presale App",
              url: "https://example.com",
            }}
            onConnect={handleWalletConnected}
          />
        </div>

        {/* Alternative Manual Connect Button */}
        {/* <div className="flex justify-center mb-8">
          <button
            onClick={connectWalletManually}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
          >
            Connect Wallet Manually
          </button>
        </div> */}

        {/* Debug Status Section */}
        {/* <div className="p-4 max-w-xl mx-auto bg-gray-100 rounded-xl shadow-md mb-4">
          <h3 className="text-lg font-semibold">Connection Status</h3>
          <p className="text-blue-600">{connectionStatus}</p>
          <div className="mt-2 text-sm">
            <p><strong>Account:</strong> {account || "Not connected"}</p>
            <p><strong>Contract:</strong> {contract ? "Initialized" : "Not initialized"}</p>
            <p><strong>Contract Address:</strong> {contractAddress}</p>
            {Object.keys(debugInfo).length > 0 && (
              <div className="mt-2 p-2 bg-gray-200 rounded">
                <p><strong>Debug Info:</strong></p>
                {Object.entries(debugInfo).map(([key, value]) => (
                  <p key={key}><strong>{key}:</strong> {String(value)}</p>
                ))}
              </div>
            )}
          </div>
        </div> */}

        {/* Always show the presale UI */}
        <div className="p-4 max-w-xl mx-auto bg-white rounded-xl shadow-md space-y-4">
          <h2 className="text-xl font-bold text-center text-black">Presale Info</h2>
          
          {account && (
			<div className="bg-green-100 text-green-800 p-2 rounded-lg text-center">
				Connected: {account.slice(0, 6)}...{account.slice(-4)}
				{isAdmin && <span className="ml-2 px-2 py-0.5 bg-yellow-300 text-yellow-800 rounded-full text-xs font-bold">Admin</span>}
			</div>
		  )}

          <div className="space-y-2 mt-4">
		  	<input
			type="text"
			placeholder="Referrer Address (optional)"
			value={referrer}
			onChange={(e) => setReferrer(e.target.value)}
			className="w-full border p-2 rounded text-black"
			/>
			<input
			type="number"
			min="0.036"
			step="0.001"
			placeholder="BNB Amount"
			value={bnbAmount}
			onChange={(e) => setBnbAmount(e.target.value)}
			className="w-full border p-2 rounded text-black"
			/>

            <button 
              onClick={handleBuy} 
              className={`${contract ? "bg-green-500 hover:bg-green-600" : "bg-gray-400"} text-white px-4 py-2 rounded w-full transition-colors`}
              disabled={!contract}
            >
              {contract ? "Buy Tokens" : "Connect Wallet First"}
            </button>
          </div>

          {/* Show accumulated referral reward if available */}
          {referralReward !== "0" && (
            <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-lg">
              Your accumulated referral reward: <strong>{referralReward} BNB</strong>
            </div>
          )}

          <div className="text-center mt-4">
            <button 
              onClick={handleClaimReferral} 
              className={`${contract ? "bg-purple-600 hover:bg-purple-700" : "bg-gray-400"} text-white px-4 py-2 rounded transition-colors`}
              disabled={!contract}
            >
              Claim Referral Rewards
            </button>
          </div>

          {status && <div className="text-center text-gray-700 mt-4 p-2 bg-gray-100 rounded">{status}</div>}

          {/* Admin Features */}
          {isAdmin && (
            <div className="mt-6 p-4 bg-yellow-100 text-yellow-800 rounded-lg">
              <h3 className="text-lg font-bold">Admin Panel</h3>
              <button 
                onClick={handleWithdrawBNB} 
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded mt-2 w-full transition-colors"
                disabled={!contract}
              >
                Withdraw BNB
              </button>

              <div className="mt-4">
                <h4 className="font-semibold">Contract Balances</h4>
                <p><strong>BNB Balance:</strong> {contractBnbBalance} BNB</p>
                <p><strong>Token Balance:</strong> {contractTokenBalance} Tokens</p>
              </div>

              <div className="mt-4">
                <h4 className="font-semibold">Withdraw Tokens</h4>
                <input
                  type="number"
                  placeholder="Amount of tokens to withdraw"
                  value={tokenWithdrawAmount}
                  onChange={(e) => setTokenWithdrawAmount(e.target.value)}
                  className="w-full border p-2 rounded"
                />
                <button
                  onClick={handleWithdrawTokens}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mt-2 w-full transition-colors"
                  disabled={!contract}
                >
                  Withdraw Tokens
                </button>
              </div>

              <div className="mt-4">
                <h4 className="font-semibold">Purchase History</h4>
                {transactions.length === 0 ? (
                  <p>No purchases yet</p>
                ) : (
                  <ul className="max-h-64 overflow-y-auto">
                    {transactions.map((transaction, index) => (
                      <li key={index} className="mt-2 p-2 bg-yellow-50 rounded">
                        <strong>{transaction.buyer.slice(0, 6)}...</strong> bought <strong>{transaction.amount} BNB</strong> worth of tokens. 
                        Referrer: <strong>{transaction.referrer === "0x0000000000000000000000000000000000000000" ? "No referrer" : transaction.referrer.slice(0, 6) + "..."}</strong> 
                        with a reward of <strong>{transaction.refBonus === "0" ? "No reward" : transaction.refBonus + " BNB"}</strong>.
                        {transaction.timestamp && <div className="text-xs text-gray-500 mt-1">{transaction.timestamp}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div className="mt-4">
                <h4 className="font-semibold">Withdrawal History</h4>
                {withdrawalEvents.length === 0 ? (
                  <p>No withdrawals yet</p>
                ) : (
                  <ul className="max-h-64 overflow-y-auto">
                    {withdrawalEvents.map((event, index) => (
                      <li key={index} className="mt-2 p-2 bg-yellow-50 rounded">
                        {event.type === "withdrawal" ? (
                          <span><strong>{event.admin.slice(0, 6)}...</strong> withdrew <strong>{event.amount} BNB</strong> at {event.timestamp}</span>
                        ) : (
                          <span><strong>{event.referrer.slice(0, 6)}...</strong> claimed <strong>{event.amount} BNB</strong> referral reward at {event.timestamp}</span>
                        )}
                        {event.transactionHash && (
                          <div className="text-xs text-gray-500 mt-1">
                            Tx: {event.transactionHash.slice(0, 10)}...
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button 
                onClick={() => fetchTransactionHistory(contract)} 
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mt-4 w-full transition-colors"
                disabled={!contract}
              >
                Refresh Transaction History
              </button>
            </div>
          )}
        </div>

        {/* <ThirdwebResources /> */}
      </div>
    </main>
  );
}

function Header() {
  return (
    <div className="text-center mb-6">
      <h1 className="text-3xl font-bold">TATE TOKEN PRESALE</h1>
      <p className="text-gray-500">Buy Tokens on Presale for up to %5000 on listing</p>
    </div>
  );
}

function ThirdwebResources() {
  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4 text-center">Resources</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ArticleCard
          title="Wallet Connect Documentation"
          href="https://portal.thirdweb.com/connect"
          description="Learn how to integrate wallet connection in your app"
        />
        <ArticleCard 
          title="Smart Contract Management"
          href="https://portal.thirdweb.com/web3"
          description="Interact with smart contracts using thirdweb"
        />
      </div>
    </div>
  );
}

function ArticleCard(props) {
  return (
    <a
      href={`${props.href}?utm_source=vite-template`}
      target="_blank"
      className="flex flex-col border border-zinc-800 p-4 rounded-lg hover:bg-zinc-900 transition-colors hover:border-zinc-700"
      rel="noreferrer"
    >
      <article>
        <h2 className="text-lg font-semibold mb-2">{props.title}</h2>
        <p className="text-sm text-zinc-400">{props.description}</p>
      </article>
    </a>
  );
}