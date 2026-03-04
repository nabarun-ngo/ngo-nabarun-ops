const { MongoClient } = require('mongodb');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient({
    datasourceUrl: process.env.POSTGRES_URL,
});

// Configuration
const MONGO_URI = process.env.MONGODB_URL || 'mongodb://localhost:27017/nabarun_stage';
const BATCH_SIZE = 100;

// Collections
const COLLECTIONS = {
    ACCOUNTS: 'accounts',
    DONATIONS: 'contributions', // MongoDB collection name
    TRANSACTIONS: 'transactions',
    EXPENSES: 'expenses',
};

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

// Parse MongoDB Date
const parseDate = (date) => {
    if (!date) return null;
    if (date.$date) return new Date(date.$date);
    if (typeof date === 'string') return new Date(date);
    if (date instanceof Date) return date;
    return null;
};

// Parse MongoDB Double
const parseDouble = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (value.$numberDouble) {
        const val = value.$numberDouble;
        if (val === 'Infinity') return Number.MAX_VALUE;
        if (val === '-Infinity') return Number.MIN_VALUE;
        if (val === 'NaN') return 0;
        return parseFloat(val);
    }
    return parseFloat(value) || 0;
};

// Map Account Status
const mapAccountStatus = (status) => {
    const statusMap = {
        'ACTIVE': 'ACTIVE',
        'INACTIVE': 'INACTIVE',
        'BLOCKED': 'BLOCKED',
    };
    return statusMap[status] || 'ACTIVE';
};

// Map Account Type
const mapAccountType = (type) => {
    const typeMap = {
        'PRINCIPAL': 'PRINCIPAL',
        'GENERAL': 'GENERAL',
        'DONATION': 'DONATION',
        'PUBLIC_DONATION': 'PUBLIC_DONATION',
    };
    return typeMap[type] || 'GENERAL';
};

// Map Donation Status
const mapDonationStatus = (status) => {
    const statusMap = {
        'RAISED': 'RAISED',
        'PAID': 'PAID',
        'PENDING': 'PENDING',
        'PAYMENT_FAILED': 'PAYMENT_FAILED',
        'PAY_LATER': 'PAY_LATER',
        'CANCELLED': 'CANCELLED',
        'UPDATE_MISTAKE': 'UPDATE_MISTAKE',
    };
    return statusMap[status] || 'RAISED';
};

// Map Donation Type
const mapDonationType = (type) => {
    const typeMap = {
        'REGULAR': 'REGULAR',
        'ONETIME': 'ONETIME',
    };
    return typeMap[type] || 'ONETIME';
};

// Map Transaction Status
const mapTransactionStatus = (status) => {
    const statusMap = {
        'PENDING': 'PENDING',
        'COMPLETED': 'COMPLETED',
        'FAILED': 'FAILED',
        'REVERSED': 'REVERSED',
    };
    return statusMap[status] || 'COMPLETED';
};

// Map Transaction Type
const mapTransactionType = (type) => {
    const typeMap = {
        'DONATION': 'DONATION',
        'EXPENSE': 'EXPENSE',
        'EARNING': 'EARNING',
        'TRANSFER': 'TRANSFER',
    };
    return typeMap[type] || 'TRANSFER';
};

// Map Expense Status
const mapExpenseStatus = (status) => {
    const statusMap = {
        'PENDING': 'PENDING',
        'APPROVED': 'APPROVED',
        'PAID': 'PAID',
        'REJECTED': 'REJECTED',
        'SETTLED': 'SETTLED',
    };
    return statusMap[status] || 'PENDING';
};

// Map MongoDB Account to Prisma Account
const mapToAccount = (doc) => {
    const bankDetail = {};
    if (doc.bankAccountHolderName) bankDetail.bankAccountHolderName = doc.bankAccountHolderName;
    if (doc.bankName) bankDetail.bankName = doc.bankName;
    if (doc.bankBranchName) bankDetail.bankBranch = doc.bankBranchName;
    if (doc.bankAccountNumber) bankDetail.bankAccountNumber = doc.bankAccountNumber;
    if (doc.bankAccountType) bankDetail.bankAccountType = doc.bankAccountType;
    if (doc.bankIFSCNumber) bankDetail.IFSCNumber = doc.bankIFSCNumber;

    const upiDetail = {};
    if (doc.upiPayeeName) upiDetail.payeeName = doc.upiPayeeName;
    if (doc.upiId) upiDetail.upiId = doc.upiId;
    if (doc.upiMobileNumber) upiDetail.mobileNumber = doc.upiMobileNumber;

    return {
        id: parseId(doc._id),
        name: doc.accountName || 'Unnamed Account',
        type: mapAccountType(doc.accountType),
        balance: parseDouble(doc.currentBalance),
        currency: 'INR',
        status: mapAccountStatus(doc.accountStatus),
        description: null,
        accountHolderName: doc.bankAccountHolderName || null,
        accountHolderId: doc.userId || null,
        activatedOn: parseDate(doc.activatedOn),
        bankDetail: Object.keys(bankDetail).length > 0 ? JSON.stringify(bankDetail) : null,
        upiDetail: Object.keys(upiDetail).length > 0 ? JSON.stringify(upiDetail) : null,
        createdAt: parseDate(doc.createdOn) || new Date(),
        updatedAt: new Date(),
        version: 0,
        deletedAt: doc.deleted ? new Date() : null,
    };
};

// Map MongoDB Donation to Prisma Donation
const mapToDonation = (doc) => {
    // Determine donor information
    const isGuest = doc.isGuest === true;
    const donorId = !isGuest && doc.userId ? doc.userId : null;
    const donorName = isGuest ? doc.guestFullNameOrOrgName : doc.donorName;
    const donorEmail = isGuest ? doc.guestEmailAddress : doc.donorEmailAddress;
    const donorPhone = isGuest ? doc.guestContactNumber : doc.donorContactNumber;

    // Map additional fields
    const additionalFields = [];
    if (doc.customFields && Array.isArray(doc.customFields)) {
        additionalFields.push(...doc.customFields);
    }

    return {
        id: parseId(doc._id),
        type: mapDonationType(doc.type),
        amount: parseDouble(doc.amount),
        currency: 'INR',
        status: mapDonationStatus(doc.status),
        donorId: donorId,
        donorName: isGuest ? donorName : null,
        donorEmail: isGuest ? donorEmail : null,
        donorPhone: isGuest ? donorPhone : null,
        isGuest: isGuest,
        startDate: parseDate(doc.startDate),
        endDate: parseDate(doc.endDate),
        raisedOn: parseDate(doc.raisedOn) || new Date(),
        paidOn: parseDate(doc.paidOn),
        confirmedById: doc.paymentConfirmedBy || null,
        confirmedOn: parseDate(doc.paymentConfirmedOn),
        paymentMethod: doc.paymentMethod || null,
        paidToAccountId: doc.accountId || null,
        forEventId: doc.eventId || null,
        paidUsingUPI: doc.paidUPIName || null,
        isPaymentNotified: doc.isPaymentNotified || false,
        transactionRef: doc.transactionRefNumber || null,
        remarks: doc.comment || null,
        cancelletionReason: doc.cancelReason || null,
        laterPaymentReason: doc.payLaterReason || null,
        paymentFailureDetail: doc.paymentFailDetail || null,
        additionalFields: additionalFields.length > 0 ? additionalFields : null,
        createdAt: parseDate(doc.raisedOn) || new Date(),
        updatedAt: new Date(),
        version: 0,
        deletedAt: doc.deleted ? new Date() : null,
    };
};

// Map MongoDB Transaction to Prisma Transaction
const mapToTransaction = (doc) => {
    return {
        id: parseId(doc._id),
        type: mapTransactionType(doc.transactionType),
        status: mapTransactionStatus(doc.status),
        amount: parseDouble(doc.transactionAmt),
        description: doc.transactionDescription || '',
        referenceId: doc.transactionRefId || doc.transactionRef || null,
        referenceType: doc.transactionRefType || null,
        currency: 'INR',
        fromAccountId: doc.fromAccount || null,
        toAccountId: doc.toAccount || null,
        transactionDate: parseDate(doc.transactionDate) || new Date(),
        particulars: doc.transactionDescription || '',
        createdAt: parseDate(doc.creationDate) || new Date(),
        createdById: doc.createdById || null,
        updatedAt: new Date(),
        version: 0,
        deletedAt: doc.revertedTransaction ? new Date() : null,
    };
};

// Map MongoDB Expense to Prisma Expense
const mapToExpense = (doc) => {
    return {
        id: parseId(doc._id),
        title: doc.expenseTitle || 'Untitled Expense',
        items: doc.expenseItems || null,
        amount: parseDouble(doc.expenseAmount),
        currency: 'INR',
        status: mapExpenseStatus(doc.status),
        description: doc.expenseDescription || null,
        referenceId: doc.expenseRefId || null,
        referenceType: doc.expenseRefType || null,
        isDelegated: doc.deligated || false, // Note: MongoDB has typo 'deligated'

        // Creator information
        createdById: doc.createdById,

        // Paid by information
        paidById: doc.paidById,

        // Finalized by information
        finalizedById: doc.finalizedById,
        finalizedOn: parseDate(doc.finalizedOn),

        // Settled by information
        settledById: doc.settledById,
        settledOn: parseDate(doc.settledOn),

        // Rejected by information
        rejectedById: doc.rejectedById,

        // Updated by information
        updatedById: doc.updatedById,
        updatedOn: parseDate(doc.updatedOn),

        // Account information
        accountId: doc.expenseAccountId || null,
        accountName: doc.expenseAccountName || null,

        transactionRef: doc.transactionRefNumber || null,

        // Dates
        expenseDate: parseDate(doc.expenseDate) || new Date(),
        expenseCreated: parseDate(doc.expenseCreatedOn) || new Date(),
        remarks: doc.remarks || null,

        createdAt: parseDate(doc.expenseCreatedOn) || new Date(),
        updatedAt: new Date(),
        version: 0,
        deletedAt: doc.deleted ? new Date() : null,
    };
};

// Migrate Accounts
async function migrateAccounts(db) {
    console.log('\n=== Migrating Accounts ===');
    const collection = db.collection(COLLECTIONS.ACCOUNTS);

    const totalDocs = await collection.countDocuments();
    console.log(`Found ${totalDocs} accounts to migrate`);

    let processed = 0;
    let success = 0;
    let failed = 0;
    const errors = [];

    const cursor = collection.find({});

    while (await cursor.hasNext()) {
        const batch = [];

        for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
            batch.push(await cursor.next());
        }

        for (const doc of batch) {
            try {
                const accountId = parseId(doc._id);

                // Check if account already exists
                const existing = await prisma.account.findUnique({
                    where: { id: accountId }
                });

                if (existing) {
                    console.log(`Skipping existing account: ${accountId}`);
                    processed++;
                    continue;
                }

                // Create account
                await prisma.account.create({
                    data: mapToAccount(doc),
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
                    name: doc.accountName,
                    error: error.message,
                });
                console.error(`Error migrating account ${doc.accountName}:`, error.message);
            }
        }
    }

    console.log(`\nAccounts Migration Complete: ${success} success, ${failed} failed`);
    return { success, failed, errors };
}

// Migrate Donations
async function migrateDonations(db) {
    console.log('\n=== Migrating Donations ===');
    const collection = db.collection(COLLECTIONS.DONATIONS);

    const totalDocs = await collection.countDocuments();
    console.log(`Found ${totalDocs} donations to migrate`);

    let processed = 0;
    let success = 0;
    let failed = 0;
    const errors = [];

    const cursor = collection.find({});

    while (await cursor.hasNext()) {
        const batch = [];

        for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
            batch.push(await cursor.next());
        }

        for (const doc of batch) {
            try {
                const donationId = parseId(doc._id);

                // Check if donation already exists
                const existing = await prisma.donation.findUnique({
                    where: { id: donationId }
                });

                if (existing) {
                    console.log(`Skipping existing donation: ${donationId}`);
                    processed++;
                    continue;
                }

                // Create donation
                const donationData = mapToDonation(doc);

                // Validate foreign keys before creating
                if (donationData.donorId) {
                    const userExists = await prisma.userProfile.findUnique({
                        where: { id: donationData.donorId }
                    });
                    if (!userExists) {
                        donationData.donorId = null;
                        donationData.isGuest = true;
                    }
                }

                if (donationData.paidToAccountId) {
                    const accountExists = await prisma.account.findUnique({
                        where: { id: donationData.paidToAccountId }
                    });
                    if (!accountExists) {
                        donationData.paidToAccountId = null;
                    }
                }

                if (donationData.confirmedById) {
                    const confirmerExists = await prisma.userProfile.findUnique({
                        where: { id: donationData.confirmedById }
                    });
                    if (!confirmerExists) {
                        donationData.confirmedById = null;
                    }
                }

                await prisma.donation.create({
                    data: donationData,
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
                    donor: doc.donorName || doc.guestFullNameOrOrgName,
                    error: error.message,
                });
                console.error(`Error migrating donation ${doc.donorName}:`, error.message);
            }
        }
    }

    console.log(`\nDonations Migration Complete: ${success} success, ${failed} failed`);
    return { success, failed, errors };
}

// Migrate Transactions
async function migrateTransactions(db) {
    console.log('\n=== Migrating Transactions ===');
    const collection = db.collection(COLLECTIONS.TRANSACTIONS);

    const totalDocs = await collection.countDocuments();
    console.log(`Found ${totalDocs} transactions to migrate`);

    let processed = 0;
    let success = 0;
    let failed = 0;
    const errors = [];

    const cursor = collection.find({});

    while (await cursor.hasNext()) {
        const batch = [];

        for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
            batch.push(await cursor.next());
        }

        for (const doc of batch) {
            try {
                const transactionId = parseId(doc._id);

                // Check if transaction already exists
                const existing = await prisma.transaction.findUnique({
                    where: { id: transactionId }
                });

                if (existing) {
                    console.log(`Skipping existing transaction: ${transactionId}`);
                    processed++;
                    continue;
                }

                // Create transaction
                const transactionData = mapToTransaction(doc);

                if (transactionData.fromAccountId === null && transactionData.toAccountId === null) {
                    console.log(`Skipping transaction with unknown from and to accounts: ${transactionId}`);
                    processed++;
                    continue;
                }

                // Validate account references
                if (transactionData.fromAccountId !== null) {
                    const fromAccountExists = await prisma.account.findUnique({
                        where: { id: transactionData.fromAccountId }
                    });
                    if (!fromAccountExists) {
                        console.warn(`From account not found: ${transactionData.fromAccountId}, skipping transaction`);
                        processed++;
                        continue;
                    }
                }

                if (transactionData.toAccountId !== null) {
                    const toAccountExists = await prisma.account.findUnique({
                        where: { id: transactionData.toAccountId }
                    });
                    if (!toAccountExists) {
                        console.warn(`To account not found: ${transactionData.toAccountId}, skipping transaction`);
                        processed++;
                        continue;
                    }
                }

                await prisma.transaction.create({
                    data: transactionData,
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
                    description: doc.transactionDescription,
                    error: error.message,
                });
                console.error(`Error migrating transaction ${doc.transactionDescription}:`, error.message);
            }
        }
    }

    console.log(`\nTransactions Migration Complete: ${success} success, ${failed} failed`);
    return { success, failed, errors };
}

// Migrate Expenses
async function migrateExpenses(db) {
    console.log('\n=== Migrating Expenses ===');
    const collection = db.collection(COLLECTIONS.EXPENSES);

    const totalDocs = await collection.countDocuments();
    console.log(`Found ${totalDocs} expenses to migrate`);

    let processed = 0;
    let success = 0;
    let failed = 0;
    const errors = [];

    const cursor = collection.find({});

    while (await cursor.hasNext()) {
        const batch = [];

        for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
            batch.push(await cursor.next());
        }

        for (const doc of batch) {
            try {
                const expenseId = parseId(doc._id);

                // Check if expense already exists
                const existing = await prisma.expense.findUnique({
                    where: { id: expenseId }
                });

                if (existing) {
                    console.log(`Skipping existing expense: ${expenseId}`);
                    processed++;
                    continue;
                }

                // Create expense
                const expenseData = mapToExpense(doc);

                // Validate account reference
                if (expenseData.accountId) {
                    const accountExists = await prisma.account.findUnique({
                        where: { id: expenseData.accountId }
                    });
                    if (!accountExists) {
                        expenseData.accountId = null;
                        expenseData.accountName = null;
                    }
                }

                await prisma.expense.create({
                    data: expenseData,
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
                    title: doc.expenseTitle,
                    error: error.message,
                });
                console.error(`Error migrating expense ${doc.expenseTitle}:`, error.message);
            }
        }
    }

    console.log(`\nExpenses Migration Complete: ${success} success, ${failed} failed`);
    return { success, failed, errors };
}

// Main migration function
async function migrateFinance() {
    const mongoClient = new MongoClient(MONGO_URI);

    try {
        console.log('Connecting to MongoDB...');
        await mongoClient.connect();
        console.log('Connected to MongoDB successfully');

        const db = getDatabase(mongoClient);

        const results = {
            accounts: { success: 0, failed: 0, errors: [] },
            donations: { success: 0, failed: 0, errors: [] },
            transactions: { success: 0, failed: 0, errors: [] },
            expenses: { success: 0, failed: 0, errors: [] },
        };

        // Migrate in order: Accounts -> Donations -> Transactions -> Expenses
        results.accounts = await migrateAccounts(db);
        results.donations = await migrateDonations(db);
        results.transactions = await migrateTransactions(db);
        results.expenses = await migrateExpenses(db);

        console.log('\n=== Overall Migration Summary ===');
        console.log(`Accounts: ${results.accounts.success} success, ${results.accounts.failed} failed`);
        console.log(`Donations: ${results.donations.success} success, ${results.donations.failed} failed`);
        console.log(`Transactions: ${results.transactions.success} success, ${results.transactions.failed} failed`);
        console.log(`Expenses: ${results.expenses.success} success, ${results.expenses.failed} failed`);

        // Print errors if any
        if (results.accounts.errors.length > 0) {
            console.log('\nAccount Errors:');
            results.accounts.errors.forEach(e => {
                console.log(`  - ${e.name} (${e.id}): ${e.error}`);
            });
        }

        if (results.donations.errors.length > 0) {
            console.log('\nDonation Errors:');
            results.donations.errors.forEach(e => {
                console.log(`  - ${e.donor} (${e.id}): ${e.error}`);
            });
        }

        if (results.transactions.errors.length > 0) {
            console.log('\nTransaction Errors:');
            results.transactions.errors.forEach(e => {
                console.log(`  - ${e.description} (${e.id}): ${e.error}`);
            });
        }

        if (results.expenses.errors.length > 0) {
            console.log('\nExpense Errors:');
            results.expenses.errors.forEach(e => {
                console.log(`  - ${e.title} (${e.id}): ${e.error}`);
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
        console.log('\n=== Verifying Migration ===');
        await mongoClient.connect();
        const db = getDatabase(mongoClient);

        // Verify Accounts
        const mongoAccountsCount = await db.collection(COLLECTIONS.ACCOUNTS).countDocuments();
        const pgAccountsCount = await prisma.account.count();
        console.log(`\nAccounts:`);
        console.log(`  MongoDB: ${mongoAccountsCount}`);
        console.log(`  PostgreSQL: ${pgAccountsCount}`);
        console.log(`  Match: ${mongoAccountsCount === pgAccountsCount ? '✓' : '✗'}`);

        // Verify Donations
        const mongoDonationsCount = await db.collection(COLLECTIONS.DONATIONS).countDocuments();
        const pgDonationsCount = await prisma.donation.count();
        console.log(`\nDonations:`);
        console.log(`  MongoDB: ${mongoDonationsCount}`);
        console.log(`  PostgreSQL: ${pgDonationsCount}`);
        console.log(`  Match: ${mongoDonationsCount === pgDonationsCount ? '✓' : '✗'}`);

        // Verify Transactions
        const mongoTransactionsCount = await db.collection(COLLECTIONS.TRANSACTIONS).countDocuments();
        const pgTransactionsCount = await prisma.transaction.count();
        console.log(`\nTransactions:`);
        console.log(`  MongoDB: ${mongoTransactionsCount}`);
        console.log(`  PostgreSQL: ${pgTransactionsCount}`);
        console.log(`  Match: ${mongoTransactionsCount === pgTransactionsCount ? '✓' : '✗'}`);

        // Verify Expenses
        const mongoExpensesCount = await db.collection(COLLECTIONS.EXPENSES).countDocuments();
        const pgExpensesCount = await prisma.expense.count();
        console.log(`\nExpenses:`);
        console.log(`  MongoDB: ${mongoExpensesCount}`);
        console.log(`  PostgreSQL: ${pgExpensesCount}`);
        console.log(`  Match: ${mongoExpensesCount === pgExpensesCount ? '✓' : '✗'}`);

        // Sample verification
        console.log('\n=== Sample Data Verification ===');

        // Check a random account
        const sampleAccount = await db.collection(COLLECTIONS.ACCOUNTS).findOne({});
        if (sampleAccount) {
            const accountId = parseId(sampleAccount._id);
            const pgAccount = await prisma.account.findUnique({
                where: { id: accountId }
            });
            console.log(`\nSample Account: ${sampleAccount.accountName}`);
            console.log(`  - Exists in PostgreSQL: ${pgAccount ? '✓' : '✗'}`);
            if (pgAccount) {
                console.log(`  - Balance matches: ${parseDouble(sampleAccount.currentBalance) === parseFloat(pgAccount.balance) ? '✓' : '✗'}`);
            }
        }

        // Check a random donation
        const sampleDonation = await db.collection(COLLECTIONS.DONATIONS).findOne({});
        if (sampleDonation) {
            const donationId = parseId(sampleDonation._id);
            const pgDonation = await prisma.donation.findUnique({
                where: { id: donationId }
            });
            console.log(`\nSample Donation: ${sampleDonation.donorName || sampleDonation.guestFullNameOrOrgName}`);
            console.log(`  - Exists in PostgreSQL: ${pgDonation ? '✓' : '✗'}`);
            if (pgDonation) {
                console.log(`  - Amount matches: ${parseDouble(sampleDonation.amount) === parseFloat(pgDonation.amount) ? '✓' : '✗'}`);
            }
        }

        // Check a random expense
        const sampleExpense = await db.collection(COLLECTIONS.EXPENSES).findOne({});
        if (sampleExpense) {
            const expenseId = parseId(sampleExpense._id);
            const pgExpense = await prisma.expense.findUnique({
                where: { id: expenseId }
            });
            console.log(`\nSample Expense: ${sampleExpense.expenseTitle}`);
            console.log(`  - Exists in PostgreSQL: ${pgExpense ? '✓' : '✗'}`);
            if (pgExpense) {
                console.log(`  - Amount matches: ${parseDouble(sampleExpense.expenseAmount) === parseFloat(pgExpense.amount) ? '✓' : '✗'}`);
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
        migrateFinance()
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

module.exports = { migrateFinance, verifyMigration };
