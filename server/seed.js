require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const GroomerProfile = require('./models/GroomerProfile');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await User.deleteMany({});
  await GroomerProfile.deleteMany({});

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // Create admin
  await User.create({
    username: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@groomie.com',
    password: hash('admin123'),
    phone: '555-000-0000',
    role: 'admin',
    isVerified: true,
  });

  // Create groomers
  const groomerData = [
    { firstName: 'Maria', lastName: 'Santos', email: 'maria@groomie.com', city: 'Houston', address: '123 Main St', bio: 'Certified groomer with 8 years experience. Specialize in doodles and poodles.', yearsExperience: 8, specialties: ['Doodles', 'Poodles', 'Large Dogs'] },
    { firstName: 'James', lastName: 'Rivera', email: 'james@groomie.com', city: 'Houston', address: '456 Oak Ave', bio: 'Mobile groomer serving all of Houston. No breed too big or small.', yearsExperience: 5, specialties: ['All Breeds', 'Mobile'] },
    { firstName: 'Ashley', lastName: 'Kim', email: 'ashley@groomie.com', city: 'Austin', address: '789 Elm Rd', bio: 'Anxiety-free grooming in a calm, spa-like environment.', yearsExperience: 6, specialties: ['Anxious Dogs', 'Cats', 'Small Breeds'] },
    { firstName: 'Carlos', lastName: 'Mendez', email: 'carlos@groomie.com', city: 'Austin', address: '321 Cedar Blvd', bio: 'Show dog grooming specialist. Competition cuts my specialty.', yearsExperience: 10, specialties: ['Show Dogs', 'Sporting Breeds'] },
    { firstName: 'Tara', lastName: 'Johnson', email: 'tara@groomie.com', city: 'Dallas', address: '654 Birch St', bio: 'Family-friendly grooming shop with a gentle touch for all pets.', yearsExperience: 4, specialties: ['Family Pets', 'Puppies'] },
    { firstName: 'Mike', lastName: 'Thompson', email: 'mike@groomie.com', city: 'San Antonio', address: '987 Pine Ave', bio: 'Veteran groomer with a love for rescue dogs and senior pets.', yearsExperience: 12, specialties: ['Rescues', 'Senior Dogs', 'All Breeds'] },
    { firstName: 'Sara', lastName: 'Perez', email: 'sara@groomie.com', city: 'San Antonio', address: '147 Maple Dr', bio: 'Bilingual groomer (English/Spanish). Serving the SA community.', yearsExperience: 3, specialties: ['All Breeds', 'Cats'] },
    { firstName: 'David', lastName: 'Lee', email: 'david@groomie.com', city: 'San Antonio', address: '258 Walnut Ct', bio: 'Creative styling and breed-specific cuts. Instagram-worthy results.', yearsExperience: 7, specialties: ['Creative Styling', 'Doodles', 'Terriers'] },
  ];

  const services = [
    { name: 'Bath & Brush', description: 'Full bath, blow dry, brush out, ear cleaning, and nail trim.', price: 55, duration: 60 },
    { name: 'Full Groom', description: 'Bath, brush out, breed-specific haircut, ear cleaning, and nail trim.', price: 85, duration: 90 },
    { name: 'Nail Trim', description: 'Quick nail trim and filing.', price: 20, duration: 20 },
    { name: 'Deshedding Treatment', description: 'Deep deshedding treatment to reduce shedding by up to 80%.', price: 70, duration: 75 },
  ];

  for (const g of groomerData) {
    const user = await User.create({
      username: g.firstName.toLowerCase(),
      firstName: g.firstName,
      lastName: g.lastName,
      email: g.email,
      password: hash('groomer123'),
      phone: '555-100-0000',
      role: 'groomer',
      isVerified: true,
    });

    await GroomerProfile.create({
      user: user._id,
      city: g.city,
      address: g.address,
      bio: g.bio,
      yearsExperience: g.yearsExperience,
      specialties: g.specialties,
      services,
      verificationStatus: 'approved',
      rating: Math.round((Math.random() * 1.5 + 3.5) * 10) / 10,
      reviewCount: Math.floor(Math.random() * 40) + 5,
    });
  }

  // Create a test customer
  await User.create({
    username: 'customer',
    firstName: 'Test',
    lastName: 'Customer',
    email: 'customer@test.com',
    password: hash('customer123'),
    phone: '555-200-0000',
    role: 'customer',
    isVerified: true,
  });

  console.log('Seed complete!');
  console.log('---');
  console.log('Admin:    admin@groomie.com / admin123');
  console.log('Customer: customer@test.com / customer123');
  console.log('Groomers: maria@groomie.com / groomer123 (and others)');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
