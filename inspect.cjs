const ExcelJS = require('exceljs');
const path = require('path');

async function run() {
  const file = path.join('c:/Users/Admin/Desktop', 'Quá trình chấm công_2026-04-01_2026-04-30.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const worksheet = workbook.worksheets[0];
  
  let i = 0;
  worksheet.eachRow((row, rowNumber) => {
    if (i < 20) {
      console.log(`Row ${rowNumber}:`, row.values);
      i++;
    }
  });
}
run().catch(console.error);
