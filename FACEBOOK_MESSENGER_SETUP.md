# Meta Facebook Messenger CRM Integration - Setup & Operations Guide

This guide provides step-by-step instructions for configuring your Meta Developer App ("crm inbox") and connecting your Facebook Page ("Elite Phone Repair-Houston") to the Elite Phone Repair CRM.

---

## 1. Required Server Secrets & Configuration

The integration requires the following server-side environment variables / secrets stored securely in Supabase:

| Secret Key | Description | Example / Placeholder Value |
| :--- | :--- | :--- |
| `META_APP_SECRET` | App Secret from Meta Developer Console (App Settings -> Basic) | `a1b2c3d4e5f67890abcdef1234567890` |
| `META_PAGE_ACCESS_TOKEN` | Long-lived Page Access Token for "Elite Phone Repair-Houston" | `EAAG... (Page Token from Meta)` |
| `META_VERIFY_TOKEN` | Secure random string used to verify webhook subscription | `epr_messenger_verify_998877_secure` |
| `META_PAGE_ID` | Facebook Page ID for "Elite Phone Repair-Houston" | `102938475610293` |
| `META_GRAPH_API_VERSION` | Meta Graph API Version | `v21.0` |

### How to Set Secrets via Supabase CLI
Run the following command in your terminal to set your secrets securely:

```bash
supabase secrets set META_APP_SECRET="your_actual_app_secret" \
  META_PAGE_ACCESS_TOKEN="your_actual_page_access_token" \
  META_VERIFY_TOKEN="your_generated_verify_token" \
  META_PAGE_ID="your_actual_page_id" \
  META_GRAPH_API_VERSION="v21.0"
```

---

## 2. Deploying Edge Functions & Deployed Webhook Callback URL

Deploy the two Supabase Edge Functions using the Supabase CLI:

```bash
# 1. Deploy receive-facebook-messenger Webhook Function
supabase functions deploy receive-facebook-messenger --no-verify-jwt

# 2. Deploy send-facebook-messenger Function
supabase functions deploy send-facebook-messenger
```

### Deployed Callback URL Format
Once deployed, your public HTTPS Webhook Callback URL will be:

`https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/receive-facebook-messenger`

*(Replace `<YOUR_SUPABASE_PROJECT_REF>` with your Supabase Project Reference ID found in Supabase Settings -> API).*

---

## 3. How to Create & Store a Secure Verify Token

1. Generate a secure random string (e.g., using `openssl rand -hex 16` in terminal or a secure password generator).
2. Save this token as `META_VERIFY_TOKEN` in your Supabase secrets.
3. Paste the **exact same token string** into the "Verify Token" field in Meta Developer Console when configuring the Webhook.

---

## 4. Meta Developer Console Webhook Configuration

1. Log in to the [Meta Developer Console](https://developers.facebook.com/).
2. Select your app: **"crm inbox"**.
3. Under **Add Products** or **Messenger**, go to **Messenger -> Settings** or **Webhooks**.
4. Click **Configure Webhooks** or **Edit Callback URL**.
5. Fill out the dialog:
   - **Callback URL**: `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/receive-facebook-messenger`
   - **Verify Token**: Enter your `META_VERIFY_TOKEN` value.
6. Click **Verify and Save**. Meta will issue a GET request to your Edge Function. Upon success, the webhook will be saved.

### Webhook Fields to Subscribe
Under **Webhooks -> Page Subscriptions** for "Elite Phone Repair-Houston", subscribe to the following exact field names:

- `messages` *(Required: Inbound customer text & attachment events)*
- `messaging_postbacks` *(Required: User clicks on button postbacks)*
- `message_echoes` *(Required: Synchronize messages sent directly from Facebook Page Manager)*

---

## 5. Live Test & Verification Checklist

Complete this checklist to verify your integration end-to-end:

- [ ] **Step 1:** Run `supabase secrets set` with your actual Meta keys.
- [ ] **Step 2:** Deploy the Edge Function `receive-facebook-messenger`.
- [ ] **Step 3:** Enter Callback URL and Verify Token in Meta Developer Console.
- [ ] **Step 4:** Subscribe your connected Facebook Page ("Elite Phone Repair-Houston") to the `messages` webhook field.
- [ ] **Step 5:** From an authorized Meta Developer App tester account, send a Facebook message to your Page.
- [ ] **Step 6:** Open Elite Phone Repair CRM, click **Messenger Inbox** in the top navigation bar, and confirm the message appears in real time.
- [ ] **Step 7:** Type a response in the CRM text composer and click **Send**. Confirm receipt of the reply in Messenger.

---

## 6. App Review & Publishing Requirements

To allow non-developer public customers to message your page and receive replies:
1. Go to **Meta Developer Console -> App Review -> Permissions and Features**.
2. Request **`pages_messaging`** permission.
3. Provide a short screencast video showing:
   - Customer sending a message to "Elite Phone Repair-Houston".
   - Staff member viewing the message in Elite Phone Repair CRM.
   - Staff member replying from the CRM and customer receiving it in Messenger.
4. Submit for Meta App Review.
