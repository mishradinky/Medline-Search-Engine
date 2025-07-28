import puppeteer from "puppeteer"
import fs from "fs/promises"

const articleDataXpath1 = '//*[@class="main"]'
const articleDataXpath2 = '//*[@class="main-single"]'

const writeAllArticleDetailsToFile = async (articles) => {
    const filePath = "./articleDetails.json"
    const jsonData = JSON.stringify(articles, null, 4)
    await fs.writeFile(filePath, jsonData, "utf-8")
}

const main = async () => {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()

    const filePath = "./articleHTMLFiles.json"
    const fileContent = await fs.readFile(filePath, "utf-8")
    const pageData = JSON.parse(fileContent)
    for (let eachJsonObj of pageData) {
        const htmlString = eachJsonObj.fileContent
        await page.setContent(htmlString)
        let [article] = await page.$$(`::-p-xpath(${articleDataXpath1})`)
        if (!article) [article] = await page.$$(`::-p-xpath(${articleDataXpath2})`)

        const articleData = await page.evaluate((element) => {
            const elements = element.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, a, b, i, u, summary")
            let textContent = ""
            elements.forEach((el) => {
                if (el.textContent !== undefined) textContent += el.textContent.trim() + "\n"
            })
            return textContent
        }, article)
        eachJsonObj.fileContent = articleData
    }
    writeAllArticleDetailsToFile(pageData)

    await browser.close()
}

await main()
