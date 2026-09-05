

const API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyANzvNhQMgnQ_GktQhl1PscIkG0oGDGjqE';
const BACKEND_URL = 'https://commuteshare-backend-942119664963.asia-south1.run.app';

async function testPostRide() {
  try {
    console.log("1. Authenticating with Firebase...");
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'khhliyanage@gmail.com',
        password: '2004kalana',
        returnSecureToken: true
      })
    });
    
    if (!authRes.ok) {
      const err = await authRes.json();
      throw new Error(`Auth failed: ${JSON.stringify(err)}`);
    }
    
    const authData = await authRes.json();
    const token = authData.idToken;
    console.log("-> Successfully obtained Firebase ID token!");

    console.log("\n2. Posting a ride to Cloud Run...");
    // Tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const rideData = {
      origin: "Colombo",
      destination: "Kandy",
      date: dateStr,
      departure_time: "08:00",
      total_seats: 3,
      fuel_cost_per_seat: 500.0,
      vehicle_description: "Test Car"
    };

    const rideRes = await fetch(`${BACKEND_URL}/api/rides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(rideData)
    });

    if (!rideRes.ok) {
      const err = await rideRes.json();
      throw new Error(`Post ride failed [${rideRes.status}]: ${JSON.stringify(err)}`);
    }

    const rideResponseData = await rideRes.json();
    console.log("-> Successfully posted ride!");
    console.log(rideResponseData);
    console.log("\n=== END-TO-END VERIFICATION SUCCESSFUL ===");

  } catch (error) {
    console.error("\n=== END-TO-END VERIFICATION FAILED ===");
    console.error(error.message);
    process.exit(1);
  }
}

testPostRide();
