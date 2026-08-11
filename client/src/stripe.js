import { loadStripe } from '@stripe/stripe-js';

// Set REACT_APP_STRIPE_PUBLISHABLE_KEY in your client/.env
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '');

export default stripePromise;
