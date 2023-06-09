export interface EmailParts {
  to: Address[]; // (1...1000)
  bcc?: Address[]; // (0...1000)
  reply_to?: Address;
  subject: string;
  body: string;
  type: 'text/plain' | 'text/html';
}

export interface MailChannelsSendBody {
  personalizations: {
    to: Address[]; // (1...1000)
    from?: Address;
    reply_to?: Address;
    cc?: Address[]; // (0...1000)
    bcc?: Address[]; // (0...1000)
    subject?: string;
    dkim_domain: string; // see https://mailchannels.zendesk.com/hc/en-us/articles/7122849237389-Adding-a-DKIM-Signature
    dkim_private_key: string; // Encoded in Base64
    dkim_selector: string;
    headers?: any; // see https://api.mailchannels.net/tx/v1/documentation
  }[]; // (0...1000)
  from: Address;
  reply_to?: Address;
  subject: string;
  content: {
    type: string; // The mime type of the content you are including in your email
    value: string; // The actual content of the specified mime type that you are including in the message
  }[];
  headers?: any; // see https://api.mailchannels.net/tx/v1/documentation
}

export interface Address {
  email: string;
  name?: string;
}
