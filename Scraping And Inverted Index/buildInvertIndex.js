import { createConnection } from "mysql2/promise"
import pluralize from "pluralize"
import { lemmatizer } from "lemmatizer"
import stem from "stem-porter"

export const host = "localhost"
export const user = "root"
export const password = "password123"
const createInvertedIndexTable = `CREATE TABLE IF NOT EXISTS INVERTED_INDEX_TABLE(
                                    DOC_ID INTEGER,
                                    TERM VARCHAR(250),
                                    TERM_FREQ INT)`

const createDictionaryTable = `CREATE TABLE DICTIONARY_TABLE (
                                term VARCHAR(250) PRIMARY KEY,
                                doc_frequency INT,
                                collection_frequency INT
                                ) AS
                                SELECT 
                                    term, 
                                    COUNT(DISTINCT doc_id) AS doc_frequency, 
                                    SUM(term_freq) AS collection_frequency
                                FROM 
                                    INVERTED_INDEX_TABLE
                                GROUP BY 
                                    term;`
const createPostingTable = `CREATE TABLE POSTING_TABLE (
                                term VARCHAR(250),
                                doc_id INTEGER,
                                term_freq INT
                                ) AS
                                SELECT 
                                    term,
                                    doc_id,
                                    term_freq
                                FROM 
                                    INVERTED_INDEX_TABLE;`
const updateForeignKey = `ALTER TABLE POSTING_TABLE
                            ADD CONSTRAINT fk_term
                            FOREIGN KEY (term) REFERENCES DICTIONARY_TABLE(term);`

const getMedlineData = async (db) => {
    const result = await db.query(`SELECT ID, ARTICLE_DATA FROM MEDLINEDATA`)
    return result[0]
}

const createTable = async (connection, createTableQuery, tableName) => {
    // Creates a table using createTableQuery. query is  defined at top of the file
    await connection.query(createTableQuery)

    console.log(`Created table ${tableName}`)
}

// Tokenizer for cleaning and processing the text

export const tokenize = (text) => {
    // Step 1: Remove punctuation
    const cleanedText = text.replace(/[.?,:—]/g, " ").replace(/[\/#!$%\^&\*;{}=\-+_`~()"'|\[\]]/g, "")
    // Step 2: Convert text to lowercase
    const tokens = cleanedText.toLowerCase().split(/\s+/)

    // Step 3: Convert plurals to singular using pluralize
    const singularTokens = tokens.map((token) => pluralize.singular(token))
    // Step 4: Convert tokens to their normal form (Stemming)
    const normalizedTokens = singularTokens.map((token) => {
        return stem(token)
    })
    return normalizedTokens
}

export const getTermFrequenciesFromDoc = (tokens) => {
    const frequencies = {}

    for (const item of tokens) {
        // Increment the count if the item exists, or initialize it to 1 if it doesn't
        frequencies[item] = (frequencies[item] || 0) + 1
    }

    return frequencies
}

const insertBatchIntoDB = async (connection, rows) => {
    const insertDBQuery = "INSERT INTO INVERTED_INDEX_TABLE (TERM, DOC_ID, TERM_FREQ) VALUES ?"
    try {
        const formattedRows = rows.map(({ term, docId, frequency }) => [term, docId, frequency])
        await connection.query(insertDBQuery, [formattedRows])
    } catch (err) {
        console.error("Error inserting batch into DB:", err)
    }
}

const main = async () => {
    // Create a connection to MySQL server
    const medlineDB = await createConnection({ host, user, password, database: "MEDLINEDB" })

    await createTable(medlineDB, createInvertedIndexTable, "INVERTED_INDEX_TABLE")

    const allDocuments = await getMedlineData(medlineDB)

    const tokenizedDocuments = allDocuments.map((eachDocument) => {
        const id = eachDocument.ID

        return {
            id,
            tokens: tokenize(eachDocument.ARTICLE_DATA),
        }
    })

    for (const eachDocument of tokenizedDocuments) {
        const { id, title, tokens } = eachDocument
        const termFrequency = getTermFrequenciesFromDoc(tokens)

        // Prepare term frequencies for batch insertion
        const batchValues = Object.entries(termFrequency).map(([term, frequency]) => ({
            docId: id,
            term,
            frequency,
        }))

        // Insert all rows for the document in a single query
        await insertBatchIntoDB(medlineDB, batchValues)

        console.log(`Inserted all terms for document ID: ${id}`)
    }

    await createTable(medlineDB, createDictionaryTable, "DICTIONARY_TABLE") // Subquery calculates the doc frequency and collection frequency
    await createTable(medlineDB, createPostingTable, "POSTING_TABLE")
    await medlineDB.query(updateForeignKey)
    await medlineDB.close()
}

await main()
