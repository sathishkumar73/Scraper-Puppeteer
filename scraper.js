const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();
  await page.goto('https://data.gov.in');

  // select the agriculture section
  await Promise.all([
    page.waitForNavigation('networkidle0'),
    page.click("li.views-row.views-row-6.views-row-even.views-row-last"),
  ]);


  page.click('a[title="Coffee Production in India from 2001-02 to 2016-17"]')
  page.on('dialog', async dialog => {
    dialog.accept();
  })

  const getNewPageWhenLoaded =  async () => {
    return new Promise(x =>
        browser.on('targetcreated', async target => {
            if (target.type() === 'page') {
                const newPage = await target.page();
                const newPagePromise = new Promise(y =>
                    newPage.once('domcontentloaded', () => y(newPage))
                );
                const isPageLoaded = await newPage.evaluate(
                    () => document.readyState
                );
                return isPageLoaded.match('complete|interactive')
                    ? x(newPage)
                    : x(newPagePromise);
            }
        })
    );
};


  const newPagePromise = getNewPageWhenLoaded();
  const newPage = await newPagePromise;

  await newPage.waitForSelector('a[title="Filtered Data"]');
  await newPage.click('a[title="Filtered Data"]');
  setTimeout(()=>{
    newPage.select('select[name="data_table_length"', '100');
    const result = newPage.$$eval('#data_table tr', rows => {
      let returnArray = Array.from(rows, row => {
        const headers = row.querySelectorAll('tr th');
        const columns = row.querySelectorAll('tr td');
        const values = [...headers, ...columns]
        // columns.push(...row.querySelectorAll('tr td'));
        return Array.from(values, column => column.innerText)
      });
      return returnArray;
    });
    result.then(function(result) {
      var csv = [];
      // Select rows from table_id
      var rows = result;
      // Construct csv
      var csv = [];
      var seperator = ',';
      for (var i = 0; i < rows.length; i++) {
        var row = [], cols = result[i];
          for (var j = 0; j < cols.length; j++) {
              // Clean innertext to remove multiple spaces and jumpline (break csv)
              var data = cols[j].replace(/(\r\n|\n|\r)/gm, '').replace(/(\s\s)/gm, ' ')
              // Escape double-quote with double-double-quote (see https://stackoverflow.com/questions/17808511/properly-escape-a-double-quote-in-csv)
              data = data.replace(/"/g, '""');
              // Push escaped string
              row.push('"' + data + '"');
          }
          csv.push(row.join(seperator));
      }
      // Download it
      var csv_string = csv.join('\n');
      fs.writeFileSync("test.csv", csv_string);
      browser.close();
  })
},500);

})()