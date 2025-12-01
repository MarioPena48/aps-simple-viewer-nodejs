// Load environment: prefer .env.development when NODE_ENV=development, otherwise .env
const path = require('path');
const fs = require('fs');

const envFileName = process.env.NODE_ENV === 'development' ? '.env.development' : '.env';
const primaryEnvPath = path.resolve(__dirname, envFileName);
const fallbackEnvPath = envFileName === '.env'
    ? path.resolve(__dirname, '.env.development')
    : path.resolve(__dirname, '.env');

if (fs.existsSync(primaryEnvPath)) {
    require('dotenv').config({ path: primaryEnvPath, override: true });
} else if (fs.existsSync(fallbackEnvPath)) {
    require('dotenv').config({ path: fallbackEnvPath, override: true });
} else {
    require('dotenv').config(); // default lookup as last resort
}

// Strip surrounding quotes that may be present in .env values
const clean = (val) => {
    if (typeof val !== 'string') return val;
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        return val.slice(1, -1);
    }
    return val;
};

let { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_BUCKET, PORT } = process.env;
APS_CLIENT_ID = clean(APS_CLIENT_ID);
APS_CLIENT_SECRET = clean(APS_CLIENT_SECRET);
APS_BUCKET = clean(APS_BUCKET);
PORT = clean(PORT);

if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
    console.warn('Missing some of the environment variables.');
    process.exit(1);
}
APS_BUCKET = APS_BUCKET || `${APS_CLIENT_ID.toLowerCase()}-basic-app`;
PORT = PORT || 8081;

module.exports = {
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    APS_BUCKET,
    PORT
};
