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

    function generateBatchRequest(invoices) {
      return {
        "BatchItemRequest": invoices.map((invoice, index) => ({
          "bId": `bid${index + 1}`,
          "operation": "create",
          "Invoice": {
            "TxnDate": invoice.txnDate,
            "Line": [
              {
                "Amount": invoice.amount,
                "DetailType": "SalesItemLineDetail",
                "SalesItemLineDetail11": {
                  "ItemRef": {
                    "value": invoice.itemRefValue
                    ,"name": invoice.itemRefName
                  }
                }
              }
            ],
            "CustomerRef": {
              "value": invoice.customerRefValue
            }
          }
        }))
      };
    }

    const invoices = [
      { txnDate: '2024-10-04' , amount: 102.00, itemRefValue: "1", itemRefName: "Services", customerRefValue: "27"},
      { txnDate: '2024-10-04' , amount: 102.00, itemRefValue: "1", itemRefName: "Services", customerRefValue: "27"},
        // Add more invoice objects here
    ]

    const batchRequest = generateBatchRequest(invoices);

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
          const invoiceBody = JSON.parse(body);
          console.log('Success:', invoiceBody);

          const invoiceBodyResponse = invoiceBody.BatchItemResponse.forEach((response) => {
            if(response.Invoice){
            console.log('ID: ', response.Invoice.Id,'DOC ', response.Invoice.DocNumber)
            } 
        })

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