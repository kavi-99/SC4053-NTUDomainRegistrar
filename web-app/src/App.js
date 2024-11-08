import React, { useState, useEffect } from 'react';
import './App.css'; 
import { ethers } from 'ethers';
import Auction from './contracts/DomainRegistrar.json';
const AuctionContractAddress = '0x9995eb19c4afa44d902194609ae448cd30f54585';
// const AuctionContractAddress = "0x851a9d9922aa2599ee574cabbab9941e2f7f5c4f";
function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [domain, setDomain] = useState('');
  const [biddersCount, setBiddersCount] = useState(0);
  const [domainAuction, setDomainAuction] = useState({});
  const [phase, setPhase] = useState('None');
  const [bidAmount, setBidAmount] = useState('');
  const [secret, setSecret] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState(0);
  const [registeredDomains, setRegisteredDomains] = useState([]);
  const [queryDomain, setQueryDomain] = useState('');
  const [domainOwner, setDomainOwner] = useState('');
  const [queryOwnerAddress, setQueryOwnerAddress] = useState('');
  const [ownedDomains, setOwnedDomains] = useState([]);
  const [sendAmount, setSendAmount] = useState('');
  const [targetDomain, setTargetDomain] = useState('');
  const [status, setStatus] = useState("Start by entering a domain name to auction, e.g. example.ntu");

  useEffect(() => {
    // Initialize provider and contract on component mount
    async function initializeProviderAndContract() {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(provider);
        console.log('Provider initialized:', provider);

        const accounts = await provider.send('eth_requestAccounts', []);
        setAccount(accounts[0]);
        console.log('Connected account:', accounts[0]);

        const signer = provider.getSigner();
        setSigner(signer);
        console.log('Signer set:', signer);

        const contract = new ethers.Contract(AuctionContractAddress, Auction.abi, signer);
        setContract(contract);
        console.log('Contract instance created:', contract);
      } catch (error) {
        console.error('Error initializing provider and contract:', error);
      }
    }

    if (window.ethereum) {
      initializeProviderAndContract();
      
      window.ethereum.on('accountsChanged', (newAccounts) => {
        console.log('Account changed:', newAccounts[0]);
        setAccount(newAccounts[0]);
      });
    } else {
      console.error('Ethereum provider not found. Please install MetaMask or another wallet.');
    }
  }, []);

  useEffect(() => {
    // Set up an interval to fetch data periodically
    // console.log("Available functions:", Object.keys(contract.functions));

    const interval = setInterval(() => {
      fetchRegisteredDomains();
      fetchAuctionData();
    }, 10000); // 10000 ms = 10 seconds
  
    // Clear interval on component unmount
    return () => clearInterval(interval);
  }); 

  // Fetch auction data
  const fetchAuctionData = async () => {
    try {
      if (!contract || !domain) {
        console.warn('Contract or domain not set. Skipping fetchAuctionData.');
        return;
      }

      console.log('Fetching auction data for domain:', domain);

      const biddersCount = await contract.getBiddersCountByDomain(domain);
      const phase = await contract.retrieveDomainPhase(domain);
      const domainAuction = await contract.domainAuctions(domain);
      console.log(domainAuction)
      setBiddersCount(biddersCount.toNumber());
      setPhase(phase);
      setDomainAuction(domainAuction);

      console.log('Auction data fetched:', {
        biddersCount: biddersCount.toNumber(),
        phase,
        domainAuction,
      });
    } catch (error) {
      console.error('Error fetching auction data:', error);
    }
  };

  // Start Commit Phase
  const startCommitPhase = async () => {
    try {
      console.log('Starting commit phase for domain:', domain);
      setStatus(`Starting commit phase for domain: ${domain}, Please Wait...`);      //status 
      const tx = await contract.startCommitPhase(domain);
      await tx.wait();
      console.log('Commit phase started');
      setStatus('Commit phase started');
      fetchAuctionData();
    } catch (error) {
      console.error('Error starting commit phase:', error);
      setStatus('Error starting commit phase. See console for details.');
    }
  };

  // Commit Bid
  const commitBid = async () => {
    try {
      console.log('Committing bid for domain:', domain, 'with amount:', bidAmount, 'and secret:', secret);
      setStatus(`Committing bid for domain: ${domain}, with amount: ${bidAmount}, and secret: ${secret}, Please Wait...`);
      const commitment = ethers.utils.solidityKeccak256(
        ["address", "uint256", "string"],
        [account, ethers.utils.parseEther(bidAmount), secret]
      );

      const tx = await contract.commitBid(domain, ethers.utils.parseEther(bidAmount), secret, { value: ethers.utils.parseEther(bidAmount) });
      await tx.wait();
      console.log('Bid committed');
      setStatus('Bid committed');
      fetchAuctionData();
    } catch (error) {
      console.error('Error committing bid:', error);
      setStatus('Error committing bid. See console for details');
    }
  };

  // Start Reveal Phase
  const startRevealPhase = async () => {
    try {
      console.log('Starting reveal phase for domain:', domain);
      setStatus(`Starting reveal phase for domain: ${domain}, Please Wait...`);
      const tx = await contract.startRevealPhase(domain);
      await tx.wait();
      console.log('Reveal phase started');
      setStatus('Reveal phase started');
      fetchAuctionData();
    } catch (error) {
      console.error('Error starting reveal phase:', error);
      setStatus('Error starting reveal phase. See console for details.');
    }
  };

  // Reveal Bid
  const revealBid = async () => {
    try {
      console.log('Revealing bid for domain:', domain, 'with amount:', bidAmount, 'and secret:', secret);
      setStatus(`Revealing bid for domain: ${domain}, with amount ${bidAmount}, and secret: ${secret}, Please Wait...`);
      const tx = await contract.revealBid(domain, ethers.utils.parseEther(bidAmount), secret);
      await tx.wait();
      console.log('Bid revealed');
      setStatus('Bid revealed');
      fetchAuctionData();
    } catch (error) {
      console.error('Error revealing bid:', error);
      setStatus('Error revealing bid. See console for details.');
    }
  };

  // Finalize Auction
  const finalizeAuction = async () => {
    try {
      console.log('Finalizing auction for domain:', domain);
      setStatus(`Finalizing auction for domain: ${domain}, Please Wait...`);
      const tx = await contract.finalizeAuction(domain);
      await tx.wait();
      console.log('Auction finalized');
      setStatus('Auction finalized');
      fetchAuctionData();
    } catch (error) {
      console.error('Error finalizing auction:', error);
      console.error('Error finalizing auction. See console for details.');
    }
  };

  // Withdraw funds
  const withdraw = async () => {
    try {
      console.log('Withdrawing funds for account:', account);
      setStatus(`Withdrawing funds for account: ${account}, Please Wait...`);
      const tx = await contract.withdraw();
      await tx.wait();
      console.log('Funds withdrawn');
      setStatus(`Funds withdrawn`);
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      setStatus('Error withdrawing funds. See console for details.');
    }
  };

    // Fetch registered domains
    const fetchRegisteredDomains = async () => {
      if (!contract) return;
      try {
        const domains = await contract.getRegisteredDomains();
        setRegisteredDomains(domains);
        console.log('Registered domains:', domains);
      } catch (error) {
        console.error('Error fetching registered domains:', error);
      }
    };
  
    // Get owner's address for a specific domain
    const getDomainOwner = async () => {
      if (!contract || !queryDomain) return;
      try {
        const ownerAddress = await contract.resolveDomainToAddress(queryDomain);
        setDomainOwner(ownerAddress);
        console.log(`Owner of domain ${queryDomain}:`, ownerAddress);
      } catch (error) {
        console.error('Error fetching domain owner:', error);
      }
    };
  
    // Get all domains owned by a specific address
    const getOwnedDomains = async () => {
      if (!contract || !queryOwnerAddress) return;
      try {
        const domains = await contract.resolveAddressToDomains(queryOwnerAddress);
        setOwnedDomains(domains);
        console.log(`Domains owned by ${queryOwnerAddress}:`, domains);
      } catch (error) {
        console.error('Error fetching owned domains:', error);
      }
    };
  
    // Send Ether to the owner of a domain
    const sendEtherToDomainOwner = async () => {
      if (!contract || !targetDomain || !sendAmount) return;
      try {
        // Get owner's address
        setStatus(`Sending ${sendAmount} ETH to the owner of ${targetDomain}. Please Wait...`);
        const ownerAddress = await contract.resolveDomainToAddress(targetDomain);
        if (ownerAddress === ethers.constants.AddressZero) {
          console.error("Domain owner address not found.");
          return;
        }
  
        const tx = await signer.sendTransaction({
          to: ownerAddress,
          value: ethers.utils.parseEther(sendAmount),
        });
        await tx.wait();
        console.log(`Sent ${sendAmount} ETH to the owner of ${targetDomain}`);
        setStatus(`Sent ${sendAmount} ETH to the owner of ${targetDomain}`);
      } catch (error) {
        console.error('Error sending Ether to domain owner:', error);
      }
    };  

  return (
<div className="App">
  <div className="title">NTU Domain Auction Platform</div>

  <div className="main-content">
    <div className="section">
      <h2>Connected Account: {account}</h2>
      <input type="text" placeholder="Domain Name" value={domain} onChange={(e) => setDomain(e.target.value)} />
      <button onClick={fetchAuctionData}>Load Auction Details</button>
    </div>
    
    <div className="section">
      <h2>Auction Details</h2>
      <p>Current Phase: {phase}</p>
      <p>Number of Bidders: {biddersCount}</p>
      <p>Highest Bidder: {domainAuction.highestBidder}</p>
      <p>Highest Bid: {ethers.utils.formatEther(domainAuction.highestBid || '0')} ETH</p>
    </div>
    
    <div className="section">
      <h2>Commit Phase</h2>
      <button onClick={startCommitPhase}>Start Commit Phase</button>
      <input type="text" placeholder="Bid Amount (ETH)" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} />
      <input type="text" placeholder="Secret" value={secret} onChange={(e) => setSecret(e.target.value)} />
      <button onClick={commitBid}>Commit Bid</button>
    </div>

    <div className="section">
      <h2>Reveal Phase</h2>
      <button onClick={startRevealPhase}>Start Reveal Phase</button>
      <input type="text" placeholder="Reveal Bid Amount" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} />
      <input type="text" placeholder="Reveal Secret" value={secret} onChange={(e) => setSecret(e.target.value)} />
      <button onClick={revealBid}>Reveal Bid</button>
    </div>

    <div className="section">
      <h2>Finalize Auction</h2>
      <button onClick={finalizeAuction}>Finalize Auction</button>
    </div>

    <div className="section">
      <h2>Withdraw Funds</h2>
      <button onClick={withdraw}>Withdraw</button>
    </div>
  </div>

  {/* Side Panel */}
  <div className="side-panel">
    <div>
      <h2>Registered Domains</h2>
      <p>{registeredDomains.join(', ')}</p>
    </div>

    <div>
      <h3>Status</h3>
      <p className="status-box">{status}</p> 
    </div>

    <div>
      <h3>Find Domain Owner</h3>
      <input type="text" placeholder="Enter domain" value={queryDomain} onChange={(e) => setQueryDomain(e.target.value)} />
      <button onClick={getDomainOwner}>Get Owner</button>
      {domainOwner && <p>Owner of {queryDomain}: {domainOwner}</p>}
    </div>

    <div>
      <h3>Find Domains by Owner Address</h3>
      <input type="text" placeholder="Enter owner address" value={queryOwnerAddress} onChange={(e) => setQueryOwnerAddress(e.target.value)} />
      <button onClick={getOwnedDomains}>Get Owned Domains</button>
      <ul>
        {ownedDomains.map((d, index) => (
          <li key={index}>{d}</li>
        ))}
      </ul>
    </div>

    <div>
      <h3>Send Ether to Domain Owner</h3>
      <input type="text" placeholder="Domain to send Ether to" value={targetDomain} onChange={(e) => setTargetDomain(e.target.value)} />
      <input type="text" placeholder="Amount (ETH)" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} />
      <button onClick={sendEtherToDomainOwner}>Send Ether</button>
    </div>
  </div>
</div>


  );
}


export default App;
