// File: api/generate-pdf.js
import PDFDocument from 'pdfkit';

export default async function handler(req, res) {
    // URL se details nikalna
    const { name, amount, seva, txId, phone, date } = req.query;

    // Browser ko batana ki ye ek PDF file hai
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ISKCON_Receipt_${txId}.pdf`);

    // PDF Initialize karna
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // Saffron Color Border
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke('#f28c28');
    doc.rect(22, 22, doc.page.width - 44, doc.page.height - 44).stroke('#f28c28');

    // Header Section
    doc.moveDown(2);
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#d35400').text('ISKCON BHUVAIKUNTHA', { align: 'center' });
    doc.fontSize(12).fillColor('#555555').text('Sri Sri Radha Pandharinath Mandir', { align: 'center' });
    doc.moveDown(1);
    
    // Title
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text('OFFICIAL DONATION RECEIPT', { align: 'center', underline: true });
    doc.moveDown(2);

    const receiptDate = date ? new Date(parseInt(date)).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');

    // Receipt Meta Data
    doc.fontSize(12).font('Helvetica-Bold').text(`Transaction ID: `, { continued: true }).font('Helvetica').text(txId || 'N/A');
    doc.font('Helvetica-Bold').text(`Date: `, { continued: true }).font('Helvetica').text(receiptDate);
    doc.moveDown(1.5);

    // Donor Info Box
    doc.font('Helvetica-Bold').fontSize(14).text('Donor Information:');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text(`Name: `, { continued: true }).font('Helvetica').text(decodeURIComponent(name || 'Devotee'));
    doc.font('Helvetica-Bold').text(`Mobile Number: `, { continued: true }).font('Helvetica').text(phone || 'N/A');
    doc.moveDown(1.5);

    // Donation Info Box
    doc.font('Helvetica-Bold').fontSize(14).text('Donation Details:');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text(`Seva Sponsored: `, { continued: true }).font('Helvetica').text(decodeURIComponent(seva || 'General Donation'));
    doc.font('Helvetica-Bold').text(`Amount Donated: `, { continued: true }).font('Helvetica').fillColor('#2e7d32').text(`Rs. ${amount} /-`);
    doc.font('Helvetica-Bold').fillColor('#000000').text(`Payment Mode: `, { continued: true }).font('Helvetica').text('ONLINE (PhonePe V2)');
    
    doc.moveDown(4);

    // Footer Message
    doc.fontSize(13).font('Helvetica-Oblique').fillColor('#d35400').text('Hare Krishna! Thank you for your generous contribution.', { align: 'center' });
    doc.fontSize(12).text('May the Supreme Lord Sri Krishna bestow His blessings upon you and your family.', { align: 'center' });
    
    doc.moveDown(3);
    doc.fontSize(10).font('Helvetica').fillColor('#999999').text('This is a computer-generated receipt and does not require a physical signature.', { align: 'center' });
    doc.text('Website: www.iskconbhuvaikuntha.com', { align: 'center' });

    // Finalize PDF
    doc.end();
}
