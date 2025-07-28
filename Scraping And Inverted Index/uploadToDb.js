import { createConnection } from "mysql2/promise"
import fs from "fs/promises"

const host = "localhost"
const user = "root"
const password = "password123"
const dbName = "MedLineDB"
const tableName = "MedLineData"

const main = async () => {
    const conn = await createConnection({ host, user, password }) // Create a connection to MySQL server

    await createDatabase(conn, dbName)
    await createTable(conn, tableName)
    const filePath = "./articleDetails.json"
    const fileContent = await fs.readFile(filePath, "utf-8")
    const pageData = JSON.parse(fileContent)

    for (let eachJsonObj of pageData) {
        await insertIntoDB(conn, eachJsonObj)
    }

    conn.close()
}

const createDatabase = async (connection, dbName) => {
    // Creates a Database if it does not exist. dbName is already defined at top of the file
    const createDBQuery = `CREATE DATABASE IF NOT EXISTS ${dbName}`
    await connection.query(createDBQuery)
    await connection.changeUser({ database: dbName })
    console.log(`Connected to Database ${dbName}\n`)
}

const createTable = async (connection, tableName) => {
    // Creates a table  if it does not exist. tableName is already defined at top of the file
    const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (
        ID  INTEGER PRIMARY KEY AUTO_INCREMENT,
        TITLE VARCHAR(100),
        LINK_TO_MEDLINE_ARTICLE VARCHAR(200),
        FILEPATH VARCHAR(250),
        ARTICLE_DATA MEDIUMTEXT);`
    await connection.query(createTableQuery)
    console.log(`Created Table ${tableName}\n`)
}

const insertIntoDB = async (connection, values) => {
    // Inserts the scraped data into the database
    const { title, href, filePath, fileContent } = values
    const insertDBQuery = `INSERT INTO ${tableName} (TITLE, LINK_TO_MEDLINE_ARTICLE, FILEPATH, ARTICLE_DATA) VALUES (?, ?, ?, ?)`

    await connection.execute(insertDBQuery, [title, href, filePath, fileContent])
}

await main()
