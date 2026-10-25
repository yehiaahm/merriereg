// Generates a VAPID key pair for Web Push (admin order notifications).
// Prints the values to the terminal only — nothing is written to disk.
// Run once, then put the three variables in your server environment
// (Railway → Variables, and your local .env for testing).
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('Add these to your server environment variables:\n');
console.log(`VAPID_PUBLIC_KEY="${publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${privateKey}"`);
console.log('VAPID_SUBJECT="mailto:you@example.com"   # use a real contact email or your https:// site URL');
console.log('\nKeep VAPID_PRIVATE_KEY secret. Do not rotate this pair later: it would invalidate every registered phone.');
