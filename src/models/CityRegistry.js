const mongoose = require("mongoose");

const cityRegistrySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true, match: /^[a-z][a-z0-9-]{1,49}$/ },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    countryCode: { type: String, required: true, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
    timezone: { type: String, required: true, trim: true, maxlength: 80 },
    aliases: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    registryVersion: { type: String, required: true, trim: true },
    rolloutStatus: { type: String, required: true, enum: ["active", "pilot", "planned", "disabled"], index: true },
    reportingEnabled: { type: Boolean, required: true, default: false, index: true },
    defaultAuthority: { type: String, required: true, trim: true, maxlength: 160 },
    supportedCategoryIds: [{ type: String, required: true, trim: true }],
    locationEnvelope: {
      south: { type: Number, required: true, min: -90, max: 90 },
      west: { type: Number, required: true, min: -180, max: 180 },
      north: { type: Number, required: true, min: -90, max: 90 },
      east: { type: Number, required: true, min: -180, max: 180 },
      quality: { type: String, required: true, enum: ["approximate", "official"] }
    },
    center: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 }
    },
    officialChannels: {
      portalUrl: { type: String, default: "", maxlength: 500 },
      helpline: { type: String, default: "", maxlength: 50 },
      mobileApp: { type: String, default: "", maxlength: 100 },
      supportsDirectApi: { type: Boolean, default: false },
      sourceUrl: { type: String, required: true, maxlength: 500 },
      verifiedAt: { type: Date, required: true }
    }
  },
  { timestamps: true }
);

cityRegistrySchema.index({ reportingEnabled: 1, name: 1 });

module.exports = mongoose.model("CityRegistry", cityRegistrySchema);
