// The licensed broker the website operates under, and the MLS its listings come from. The MLS
// requires the brokerage to be identified on the site (CSMAR Rules 12.16.3, 12.16.14 and 12.19),
// and California requires the broker's DRE license number on advertising. Set in the environment
// so the details can be filled in without a code change.

export const broker = {
  brokerageName: process.env.BROKERAGE_NAME?.trim() || null,
  brokerName: process.env.BROKER_NAME?.trim() || null,
  dreLicense: process.env.BROKER_DRE_LICENSE?.trim() || null,
  phone: process.env.BROKER_PHONE?.trim() || null,
  email: process.env.BROKER_EMAIL?.trim() || null,
};

/**
 * The MLS member the IDX feed is licensed to, when it is an agent rather than the broker. The MLS
 * requires the site to name the subscriber with the brokerage (CSMAR Rule 12.16.14), and California
 * requires the licensee's DRE license number next to their name. The environment can override them.
 */
export const subscriber = {
  // Patrick LaPointe, CSMAR member (NRDS 159055648), whose Flexmls account the Spark feed request names.
  name: process.env.SUBSCRIBER_NAME?.trim() || "Patrick LaPointe",
  dreLicense: process.env.SUBSCRIBER_DRE_LICENSE?.trim() || "02440112",
};

export const subscriberConfigured = !!(subscriber.name && subscriber.dreLicense);

/** "Patrick LaPointe, DRE #01234567", or null until both are set. */
export const subscriberLine = subscriberConfigured ? `${subscriber.name}, DRE #${subscriber.dreLicense}` : null;

export const mls = {
  /** Full name used in the required disclaimer (CSMAR Rule 12.16.21). */
  name: process.env.MLS_NAME?.trim() || "Conejo Simi Moorpark Association of REALTORS®",
  shortName: process.env.MLS_SHORT_NAME?.trim() || "CSMAR MLS",
};

export const brokerConfigured = !!(broker.brokerageName && broker.dreLicense);
