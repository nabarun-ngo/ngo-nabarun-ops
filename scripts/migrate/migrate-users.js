const { MongoClient } = require('mongodb');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient({
  datasourceUrl: process.env.POSTGRES_URL,
});

// Configuration
const MONGO_URI = process.env.MONGODB_URL || 'mongodb://localhost:27017/nabarun_stage';
const MONGO_COLLECTION = 'user_profiles';
const BATCH_SIZE = 100;

// Helper to get database from MongoDB client
const getDatabase = (client) => {
  // If MONGO_DB is explicitly set, use it; otherwise use the database from the connection URI
  return process.env.MONGO_DB ? client.db(process.env.MONGO_DB) : client.db();
};

// Utility function to parse MongoDB ID
const parseId = (id) => {
  if (typeof id === 'string') return id;
  if (id && typeof id === 'object' && id.$oid) return id.$oid;
  return id?.toString() || uuidv4();
};

// Map MongoDB document to UserProfile
const mapToUserProfile = (doc) => {
  return {
    id: parseId(doc._id),
    title: doc.title || null,
    firstName: doc.firstName || '',
    middleName: doc.middleName || null,
    lastName: doc.lastName || '',
    dateOfBirth: doc.dateOfBirth ? new Date(doc.dateOfBirth) : null,
    gender: doc.gender || null,
    about: doc.about || null,
    picture: doc.avatarUrl || null,
    email: doc.email,
    isPublic: doc.publicProfile ?? null,
    authUserId: doc.userId || null,
    status: doc.status || 'ACTIVE',
    isTemporary: false,
    isSameAddress: doc.presentPermanentSame ?? null,
    loginMethods: doc.loginMethods || null,
    panNumber: null,
    aadharNumber: null,
    donationPauseStart: doc.donationPauseStartDate ? new Date(doc.donationPauseStartDate) : null,
    donationPauseEnd: doc.donationPauseEndDate ? new Date(doc.donationPauseEndDate) : null,
    createdAt: doc.createdOn ? new Date(doc.createdOn) : new Date(),
    updatedAt: new Date(),
    version: 0,
    deletedAt: doc.deleted ? new Date() : null,
  };
};

// Map roles from MongoDB to PostgreSQL
const mapToRoles = (doc, userId) => {
  const roles = [];

  // Handle roleCodes and roleNames (could be string or array)
  const roleCodes = typeof doc.roleCodes === 'string'
    ? doc.roleCodes.split(',').map(r => r.trim())
    : Array.isArray(doc.roleCodes) ? doc.roleCodes : [];

  const roleNames = typeof doc.roleNames === 'string'
    ? doc.roleNames.split(',').map(r => r.trim())
    : Array.isArray(doc.roleNames) ? doc.roleNames : [];

  roleCodes.forEach((code, index) => {
    if (code) {
      roles.push({
        id: uuidv4(),
        roleCode: code,
        roleName: roleNames[index] || code,
        authRoleCode: code,
        isDefault: index === 0,
        userId: userId,
        createdAt: doc.createdOn ? new Date(doc.createdOn) : new Date(),
        createdBy: doc.createdBy || null,
        version: 0,
      });
    }
  });

  return roles;
};

// Map phone numbers
const mapToPhoneNumbers = (doc, userId) => {
  const phones = [];

  if (doc.phoneNumber || doc.contactNumber) {
    phones.push({
      id: uuidv4(),
      phoneCode: doc.dialCode || null,
      phoneNumber: doc.phoneNumber || doc.contactNumber || null,
      hidden: false,
      primary: true,
      userId: userId,
      version: 0,
    });
  }

  if (doc.altPhoneNumber && doc.altPhoneNumber !== doc.phoneNumber) {
    phones.push({
      id: uuidv4(),
      phoneCode: doc.dialCode || null,
      phoneNumber: doc.altPhoneNumber,
      hidden: false,
      primary: false,
      userId: userId,
      version: 0,
    });
  }

  return phones;
};

// Map addresses
const mapToAddresses = (doc, userId) => {
  const addresses = [];

  // Present address
  if (doc.addressLine1 || doc.hometown || doc.district) {
    addresses.push({
      id: uuidv4(),
      addressLine1: doc.addressLine1 || null,
      addressLine2: doc.addressLine2 || null,
      addressLine3: doc.addressLine3 || null,
      hometown: doc.hometown || null,
      zipCode: null,
      state: doc.state || null,
      district: doc.district || null,
      country: doc.country || null,
      addressType: 'present',
      userId: userId,
      version: 0,
    });
  }

  // Permanent address (only if different from present)
  if (!doc.presentPermanentSame &&
    (doc.permanentAddressLine1 || doc.permanentHometown || doc.permanentDistrict)) {
    addresses.push({
      id: uuidv4(),
      addressLine1: doc.permanentAddressLine1 || null,
      addressLine2: doc.permanentAddressLine2 || null,
      addressLine3: doc.permanentAddressLine3 || null,
      hometown: doc.permanentHometown || null,
      zipCode: null,
      state: doc.permanentState || null,
      district: doc.permanentDistrict || null,
      country: doc.permanentCountry || null,
      addressType: 'permanent',
      userId: userId,
      version: 0,
    });
  }

  return addresses;
};

// Map social media links
const mapToLinks = (doc, userId) => {
  const links = [];
  const linkMappings = [
    { field: 'facebookLink', name: 'Facebook', type: 'facebook' },
    { field: 'instagramLink', name: 'Instagram', type: 'instagram' },
    { field: 'linkedInLink', name: 'LinkedIn', type: 'linkedin' },
    { field: 'twitterLink', name: 'Twitter', type: 'twitter' },
    { field: 'whatsappLink', name: 'WhatsApp', type: 'whatsapp' },
  ];

  linkMappings.forEach(({ field, name, type }) => {
    if (doc[field]) {
      links.push({
        id: uuidv4(),
        linkName: name,
        linkType: type,
        linkValue: doc[field],
        userId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 0,
      });
    }
  });

  return links;
};

// Main migration function
async function migrateUsers() {
  const mongoClient = new MongoClient(MONGO_URI);

  try {
    console.log('Connecting to MongoDB...');
    await mongoClient.connect();
    const db = getDatabase(mongoClient);
    const collection = db.collection(MONGO_COLLECTION);

    const totalDocs = await collection.countDocuments();
    console.log(`Found ${totalDocs} documents to migrate`);

    let processed = 0;
    let success = 0;
    let failed = 0;
    const errors = [];

    // Process in batches
    const cursor = collection.find({});

    while (await cursor.hasNext()) {
      const batch = [];

      for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
        batch.push(await cursor.next());
      }

      // Process each document in the batch
      for (const doc of batch) {
        try {
          const userId = parseId(doc._id);

          // Check if user already exists
          const existing = await prisma.userProfile.findUnique({
            where: { id: userId }
          });

          if (existing) {
            console.log(`Skipping existing user: ${userId}`);
            processed++;
            continue;
          }

          // Create user with all relations in a transaction
          await prisma.$transaction(async (tx) => {
            // Create user profile
            await tx.userProfile.create({
              data: mapToUserProfile(doc),
            });

            // Create roles
            const roles = mapToRoles(doc, userId);
            if (roles.length > 0) {
              await tx.userRole.createMany({
                data: roles,
              });
            }

            // Create phone numbers
            const phones = mapToPhoneNumbers(doc, userId);
            if (phones.length > 0) {
              await tx.phoneNumber.createMany({
                data: phones,
              });
            }

            // Create addresses
            const addresses = mapToAddresses(doc, userId);
            if (addresses.length > 0) {
              await tx.address.createMany({
                data: addresses,
              });
            }

            // Create social links
            const links = mapToLinks(doc, userId);
            if (links.length > 0) {
              await tx.link.createMany({
                data: links,
              });
            }
          });

          success++;
          processed++;

          if (processed % 10 === 0) {
            console.log(`Progress: ${processed}/${totalDocs} (${success} success, ${failed} failed)`);
          }
        } catch (error) {
          failed++;
          processed++;
          errors.push({
            id: parseId(doc._id),
            email: doc.email,
            error: error.message,
          });
          console.error(`Error migrating user ${doc.email}:`, error.message);
        }
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Total: ${totalDocs}`);
    console.log(`Processed: ${processed}`);
    console.log(`Success: ${success}`);
    console.log(`Failed: ${failed}`);

    if (errors.length > 0) {
      console.log('\nFailed migrations:');
      errors.forEach(e => {
        console.log(`  - ${e.email} (${e.id}): ${e.error}`);
      });
    }

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await mongoClient.close();
    await prisma.$disconnect();
  }
}

// Verification function
async function verifyMigration() {
  const mongoClient = new MongoClient(MONGO_URI);

  try {
    await mongoClient.connect();
    const db = getDatabase(mongoClient);
    const collection = db.collection(MONGO_COLLECTION);

    const mongoCount = await collection.countDocuments();
    const pgCount = await prisma.userProfile.count();

    console.log('\n=== Verification ===');
    console.log(`MongoDB documents: ${mongoCount}`);
    console.log(`PostgreSQL records: ${pgCount}`);
    console.log(`Match: ${mongoCount === pgCount ? '✓' : '✗'}`);

    // Check random samples
    const samples = await collection.find({}).limit(5).toArray();
    for (const sample of samples) {
      const userId = parseId(sample._id);
      const pgUser = await prisma.userProfile.findUnique({
        where: { id: userId },
        include: {
          roles: true,
          phoneNumbers: true,
          addresses: true,
          socialMediaLinks: true,
        }
      });

      console.log(`\nSample check: ${sample.email}`);
      console.log(`  - User exists: ${pgUser ? '✓' : '✗'}`);
      if (pgUser) {
        console.log(`  - Roles: ${pgUser.roles.length}`);
        console.log(`  - Phone numbers: ${pgUser.phoneNumbers.length}`);
        console.log(`  - Addresses: ${pgUser.addresses.length}`);
        console.log(`  - Social links: ${pgUser.socialMediaLinks.length}`);
      }
    }

  } finally {
    await mongoClient.close();
    await prisma.$disconnect();
  }
}

// Run migration
if (require.main === module) {
  const args = process.argv.slice(2);
  const verify = args.includes('--verify');

  if (verify) {
    verifyMigration()
      .then(() => process.exit(0))
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  } else {
    migrateUsers()
      .then(() => {
        console.log('\nRunning verification...');
        return verifyMigration();
      })
      .then(() => process.exit(0))
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  }
}

module.exports = { migrateUsers, verifyMigration };
