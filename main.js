const Promise = require('bluebird')
const puppeteer = require('puppeteer')
const request = require('request')
const cloudinary = require('cloudinary')
const fs = require('fs')
const writeFile = Promise.promisify(fs.writeFile)
const appendFile = Promise.promisify(fs.appendFile)

//don't delete : https://spreadsheets.google.com/feeds/list/1ucnQU7Fcl9j0D_qdKcFzNq4a4zQ-RECcc3zYab00dHA/oo6s3r0/public/values?alt=json
const url = 'https://spreadsheets.google.com/feeds/list/1c7mICCo8kjKo2Acrhm5agXwkY5mH4eSrkHmC8Lqcmmg/od6/public/values?alt=json'

const CLOUD_NAME = "dhihbdbbw"
const API_KEY = "228176856144175"
const API_SECRET = "56wRwecH1pDvWQ29o9bZOgdpPM0"

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
})




const filePath = "screenshot.csv"
const fields =[
  "companyName",
  "link"
]


function json_file() {
  request.get({
    url: url,
    json: true,
    headers: { 'User-Agent': "request" }
  }, (err, res, data) => {
    if (err) {
      console.log('Error:', err);
    } else if (res.statusCode !== 200) {
      console.log('Status:', res.statusCode);
    } else {
      const array_filter = data.feed.entry.filter((element, index) => {
        return element.gsx$country.$t === "United States"
          && element.gsx$livechats.$t === "Intercom"
      })

      const link_company = array_filter.map(element => {
        return element.gsx$website.$t
      })
      doSnapshots(link_company)
      return link_company
    }
  })
}

json_file()


function cloudinaryPromise(shotResult, cloudinary_options, company_name) {
  return new Promise(function (res, rej) {
    cloudinary.v2.uploader.upload_stream(cloudinary_options,
      function (error, cloudinary_result) {
        if (error) {
          console.error('Upload to cloudinary failed: ', error);
          rej(error);
        }
        
        const data = [company_name, cloudinary_result.url]
        appendFile(filePath, data.join(';') + '\r\n', 'utf8')
        res(cloudinary_result);
      }
    ).end(shotResult);
  });
}


async function doScreenShot(url) {

  // await writeFile(filePath, fields.join(';') + '\r\n', 'utf8')

  const browser = await puppeteer.launch({ args: ['--window-size=1440,1000']})
  const page = await browser.newPage() 
  page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36')
  page.setViewport({ width: 1440, height: 721 })
  page.setDefaultNavigationTimeout(10000)
  await page.goto(`https://${url}`)
  await page.waitFor(4000)

  if (await page.$(".intercom-launcher-frame") !== null || await page.$(".intercom-launcher") !== null) {
    console.log("found")
    await page.waitFor(10000)

    let shotResult = await page.screenshot({ path: `${url}.png` })
      .then(result => {
        return result
      })
      .catch(e => {
        return false
      })

    const cloudinary_options = {
      public_id: `${url}.png`
    }

    cloudinaryPromise(shotResult, cloudinary_options, url)

  } else {

    console.log("not found")

  }
  await browser.close();
}



async function doSnapshots(news_sites) {
  await writeFile(filePath, fields.join(';') + '\r\n', 'utf8')

  let cloundiary_promises = [];
    for (let i = 0; i < news_sites.length; i++) {
      try {
          let cloudinary_snapshot = await doScreenShot(news_sites[i]);
          if (cloudinary_snapshot){
            cloundiary_promises.push(cloudinary_snapshot);
          }
      } catch(e) {
          console.error(`[${news_sites[i]['name'] 
            || 'Unknown site'}] Error in snapshotting news`, e);
      }
    }
  Promise.all(cloundiary_promises).then(function(val) {
      process.exit();
    });
  }

