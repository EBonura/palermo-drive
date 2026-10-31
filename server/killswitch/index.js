// Budget -> Pub/Sub -> this function -> billing disabled on the project.
// Pattern from https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications
// WARNING: disabling billing stops every service in the project, free tier included.
const functions = require('@google-cloud/functions-framework');
const { CloudBillingClient } = require('@google-cloud/billing');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const PROJECT_NAME = `projects/${PROJECT_ID}`;
const billing = new CloudBillingClient();

functions.cloudEvent('stopBilling', async cloudEvent => {
  // Pub/Sub CloudEvent: data.message.data is base64 JSON from the budget
  const raw = cloudEvent.data && cloudEvent.data.message ? cloudEvent.data.message.data : cloudEvent.data;
  const note = JSON.parse(Buffer.from(raw, 'base64').toString());
  if (!(note.costAmount > note.budgetAmount)) {
    console.log(`No action necessary. (Current cost: ${note.costAmount}, budget: ${note.budgetAmount})`);
    return;
  }
  if (!PROJECT_ID) { console.log('No project specified'); return; }
  let enabled = true;
  try {
    const [info] = await billing.getProjectBillingInfo({ name: PROJECT_NAME });
    enabled = info.billingEnabled;
  } catch (e) {
    console.log('Unable to read billing state, assuming it is enabled');
  }
  if (!enabled) { console.log('Billing already disabled'); return; }
  const [res] = await billing.updateProjectBillingInfo({ name: PROJECT_NAME, projectBillingInfo: { billingAccountName: '' } });
  console.log(`Billing disabled: ${JSON.stringify(res)}`);
});
