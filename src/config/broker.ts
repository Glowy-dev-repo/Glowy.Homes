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

export const mls = {
  /** Full name used in the required disclaimer (CSMAR Rule 12.16.21). */
  name: process.env.MLS_NAME?.trim() || "Conejo Simi Moorpark Association of REALTORS®",
  shortName: process.env.MLS_SHORT_NAME?.trim() || "CSMAR MLS",
};

export const brokerConfigured = !!(broker.brokerageName && broker.dreLicense);
