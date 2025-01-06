const { getQboInstance, getRealmId } = require('./oauth2/oauth');
const request = require('request');

async function main() {
  const checkQboInstance = () =>
    new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const qbo = getQboInstance();
        if (qbo) {
          clearInterval(interval);
          resolve(qbo);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        reject(new Error('Timeout waiting for QBO instance.'));
      }, 10000); // 10-second timeout
    });

  try {
    console.log('Waiting for QBO instance to initialize...');
    const qbo = await checkQboInstance();
    console.log('QBO instance initialized. Ready to make API requests.');

    const realmId = getRealmId();
    if (!realmId) {
      throw new Error('Realm ID is not available.');
    }

    console.log('Using Realm ID:', realmId);

    const minorversion = 'minorversion=73';

  // Function to dynamically generate the batch request
  function generateBatchRequest(deposits) {
    return {
      "BatchItemRequest": deposits.map((deposit, index) => ({
        "bId": `bid${index + 1}`,
        "operation": "create",
        "Deposit": {
          "DepositToAccountRef": {
            "value": deposit.accountValue,
            "name": deposit.accountName 
          },
          "TxnDate": deposit.txnDate,
          "Line": [
            {
              "Amount": deposit.amount,
              "LinkedTxn": [
                {
                  "TxnId": deposit.txnId,
                  "TxnType": "Invoice",
                  "TxnLineId": "0"
                }
              ]
            }
          ]
        }
      }))
    };
  }

  const deposits = [
    { accountValue: "35", accountName: "Checking", amount: 200.00, txnId: "223", txnDate: "2025-01-05" },
    { accountValue: "35", accountName: "Checking", amount: 1000.00, txnId: "231", txnDate: "2024-10-21" },
    // Add more invoice objects here
  ];

  const batchRequest = generateBatchRequest(deposits);

    const options = {
      method: 'POST',
      url: `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/batch?${minorversion}`,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${qbo.token}`, // Use qbo.token
      },
      body: JSON.stringify(batchRequest),
    };

    console.log('Making API request with options:');

    request(options, (error, response, body) => {
      if (error) {
        console.error('Error:', error);
      } else if (!error && response.statusCode === 200) {
        try {
          const depositsBody = JSON.parse(body);
          console.log('Success:', depositsBody);
          if (depositsBody.BatchItemResponse) {
            const deposits = depositsBody.BatchItemResponse.map(item => {
              const deposit = item.Deposit;
          
                // Extract Deposit ID and LinkedTxn information
                const depositId = deposit.Id;
                const linkedTxn = deposit.Line.map(line => line.LinkedTxn).flat(); // Flatten LinkedTxn arrays
            
                return { depositId, linkedTxn };
              });
            
              // Log the extracted information
              deposits.forEach((deposit, index) => {
                console.log(`Deposit ${index + 1}:`);
                console.log(`  Deposit ID: ${deposit.depositId}`);
                console.log(`  Linked Transactions:`, deposit.linkedTxn);
              });
            } else {
              console.error('No BatchItemResponse found in the response.');
            }
        } catch (parseError) {
          console.error('Error parsing JSON response:', parseError);
        }
      } else {
        console.error('Error:', response.statusCode, body);
      }
    });

  } catch (error) {
    console.error('Error processing:', error);
  }
}

main();