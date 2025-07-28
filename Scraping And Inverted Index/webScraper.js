import puppeteer from "puppeteer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { MongoClient } from "mongodb"

const url = "https://medlineplus.gov/encyclopedia.html"
const articlesAZXpath = '//*[@id="az-section2"]/ul/li/a'
const pageArticlesXpath = '//*[@id="index"]/li/a'
const folderName = "MedlineData"
const uri = "mongodb://127.0.0.1:27017"
const dbName = "MedlineDB"
const collectionName = "MedlineData"

const writeAllArticleDetailsToFile = (articles) => {
    const filePath = "./articleHTMLFiles.json"
    const jsonData = JSON.stringify(articles, null, 4)
    fs.writeFileSync(filePath, jsonData, "utf-8")
}

const createFolder = async (folderName) => {
    //  Creates a folder to store all speeches.
    try {
        fs.mkdirSync(folderName, { recursive: true }, (err) => {
            if (err) {
                console.error("Error creating folder:", err)
            } else {
                console.log(`Folder created successfully: ${folderName}`)
            }
        })
    } catch (error) {
        console.log(`error in createFolder: ${error}`)
    }
}

const addArticleDatatoFile = (anchorObj, speech) => {
    const fileName = anchorObj.title
        .replace(/ /g, "_")
        .replace(/[<>:"/\\|'?*]/g, "")
        .concat(".html")
    const filepath = path.join(folderName, fileName)

    fs.writeFileSync(filepath, speech)

    const fullFilePath = path.join(path.dirname(fileURLToPath(import.meta.url)), filepath)

    return fullFilePath
}

const getPageData = async () => {
    const [articalLinks, pageArticleLinks] = [[], []]
    const browser = await puppeteer.launch({
        headless: true,
    })
    const page = await browser.newPage()

    await page.goto(url, { waitUntil: "domcontentloaded" })
    const allArticles = await page.$$(`::-p-xpath(${articlesAZXpath})`)

    for (let articleTag of allArticles) {
        const articleObj = await page.evaluate((el) => ({ title: el.innerHTML, href: el.href }), articleTag)
        articalLinks.push(articleObj)
    }

    for (let eachArticleLink of articalLinks) {
        await page.goto(eachArticleLink.href, { waitUntil: "domcontentloaded" })
        const allPageArticlesTags = await page.$$(`::-p-xpath(${pageArticlesXpath})`)

        for (let pageArticleTag of allPageArticlesTags) {
            const pageArticleObj = await page.evaluate((el) => ({ title: el.innerHTML, href: el.href }), pageArticleTag)
            pageArticleLinks.push(pageArticleObj)
        }
    }

    for (let pageArticle of pageArticleLinks) {
        await page.goto(pageArticle.href, { waitUntil: "domcontentloaded" })
        const pageHtml = await page.content()
        pageArticle.fileContent = pageHtml
        pageArticle.filePath = addArticleDatatoFile(pageArticle, pageHtml)
        console.log(`Scraped data from ${pageArticle.title}`)
    }
    writeAllArticleDetailsToFile(pageArticleLinks)
    await browser.close()
    return pageArticleLinks
}

const insertData = async (pageData) => {
    const client = new MongoClient(uri, { useNewUrlParser: true })

    try {
        await client.connect()
        console.log("Connected to MongoDB")
        const db = client.db(dbName)
        const collection = db.collection(collectionName)
        const result = await collection.insertMany(pageData)
        console.log(`${result.insertedCount} documents were inserted`)
    } catch (error) {
        console.error("Error inserting data:", error)
    } finally {
        await client.close()
    }
}

const main = async () => {
    createFolder(folderName)
    const pageData = await getPageData()
    await insertData(pageData)
}

await main()
