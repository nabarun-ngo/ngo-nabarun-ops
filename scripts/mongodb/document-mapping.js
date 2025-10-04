print("starting ...")

/**
* DONATION 
*/

print("migrating documents ...")
const doc_mig_info = db.migration_info.findOne({ _id: "mig-doc-map-info" });
const doc_ref = db.document_references.find();

let doc_map = [];

while (doc_ref.hasNext()) {
	let document = doc_ref.next()
	if (doc_mig_info == null || document.createdOn > doc_mig_info.last_migration) {
		let documentMapping = db.document_mappings.findOne({ documentRefId: document.documentRefId })
		if (documentMapping == null && document.documentRefId != null) {
			print("Creating index for " + document._id + " with " + document.documentRefId+" - " + document.documentType);
			doc_map.push(createMapping(document._id, document.documentRefId, document.documentType, document.createdOn));

			if (document.documentType === "DONATION") {
				let donation = db.donations.findOne({ _id: document.documentRefId });
				if (donation != null) {
					print("Creating index for " + document._id + " with " + donation.transactionRefNumber+" - TRANSACTION");
					doc_map.push(createMapping(document._id, donation.transactionRefNumber, "TRANSACTION", document.createdOn));
				}
			}

			if (document.documentType == "EXPENSE") {
				let expense = db.expenses.findOne({ _id: document.documentRefId });
				if (expense != null) {
					doc_map.push(createMapping(document._id, expense.transactionRefNumber, "EXPENSE", document.createdOn));
				}
			}
		}


	}
}
db.document_mappings.insertMany(doc_map);

function createMapping(docId, refId, docType, createdOn) {
    return {
        documentId: docId,
        documentRefId: refId,
        documentType: docType,
        createdOn: createdOn
    }
}
print("END ...")
