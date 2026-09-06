import PDFDocument from 'pdfkit';

export default async function handler(req, res) {
    return new Promise((resolve) => {
        const { name, amount, seva, txId, date, pan, address } = req.query;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=ISKCON_Receipt_${txId || '1234'}.pdf`);

        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            res.status(200).send(Buffer.concat(buffers));
            resolve();
        });

        const iskconRed = '#8b0000';
        const black = '#000000';

        // 1. HEADER SECTION
        doc.font('Helvetica-Bold').fontSize(15).fillColor(iskconRed)
           .text('INTERNATIONAL SOCIETY FOR KRISHNA CONSCIOUSNESS (ISKCON)', { align: 'center' });
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor(black)
           .text('Founder Acharya: His Divine Grace A.C. Bhaktivedanta Swami Prabhupada', { align: 'center' });
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(10)
           .text('(Head Office: Hare Krishna Land, Juhu, Mumbai - 400 049)', { align: 'center' });
        
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(9)
           .text('Temple : 28A Gata No. 107 and 108, HARE KRISHNA DHAM, SRI SRI RADHA PANDHARINATH MANDIR, NEAR CHANDRABHAGA RIVER, PANDHARPUR, Solapur, Maharashtra, 413304', { align: 'center' });
        doc.text('(Registered under Bombay Public Trusts Act Vide Registration No. F2179(Bom), PAN-AAATI0017P)', { align: 'center' });
        
        doc.moveDown(1.5);
        doc.font('Helvetica-Bold').fontSize(12).text('Receipt', { align: 'center', underline: true });
        
        // 2. RECEIPT DETAILS SECTION
        const receiptDate = date ? new Date(parseInt(date)).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
        const rNo = txId ? txId.slice(-4) : '0000'; // generating short receipt no

        doc.moveDown(1.5);
        doc.fontSize(10);
        
        const startX = 50;
        let currentY = doc.y;
        
        // Line 1: Receipt No & Date
        doc.font('Helvetica').text(`Receipt No: `, startX, currentY, { continued: true }).font('Helvetica-Bold').text(`FY2627-${rNo}`);
        doc.font('Helvetica').text(`Date: `, 400, currentY, { continued: true }).font('Helvetica-Bold').text(receiptDate);
        
        // Line 2: Name
        doc.moveDown(1);
        doc.font('Helvetica').text('Received with thanks from: ', { continued: true }).font('Helvetica-Bold').text(decodeURIComponent(name || 'Devotee').toUpperCase());
        
        // Line 3: Address
        doc.moveDown(0.5);
        const decodedAddress = decodeURIComponent(address && address !== 'undefined' && address !== '' ? address : 'N/A');
        doc.font('Helvetica').text('Address: ', { continued: true }).font('Helvetica-Bold').text(decodedAddress.toUpperCase());
        
        // Line 4: Amount
        doc.moveDown(0.5);
        doc.font('Helvetica').text('Amount: ', { continued: true }).font('Helvetica-Bold').text(`Rs. ${amount}/-`);
        
        // Line 5: Donor PAN
        doc.moveDown(0.5);
        const decodedPan = decodeURIComponent(pan && pan !== 'undefined' && pan !== '' ? pan : 'NOT PROVIDED');
        doc.font('Helvetica').text('Donor PAN No: ', { continued: true }).font('Helvetica-Bold').text(decodedPan.toUpperCase());
        
        // Line 6: Payment Info
        doc.moveDown(0.5);
        doc.font('Helvetica').text('Mode Of Payment: ', { continued: true }).font('Helvetica-Bold').text(`ONLINE No : ${txId || 'N/A'}`);
        
        // Line 7: Account/Seva
        doc.moveDown(0.5);
        doc.font('Helvetica').text('On Account of: ', { continued: true }).font('Helvetica-Bold').text(`${decodeURIComponent(seva || 'General Donation').toUpperCase()}`);
        
        // 3. FOOTER SIGNATURE AREA
        doc.moveDown(1.5);
        currentY = doc.y;
        doc.font('Helvetica-Bold').text(`Created On: ${receiptDate}`, startX, currentY);
        doc.font('Helvetica').fontSize(9).text('(Draft/Cheque subject to realization)', startX, currentY + 12);
        
        doc.font('Helvetica-Bold').fontSize(10).text('Note: ', startX, currentY + 30, { continued: true }).font('Helvetica').text('This is a computer generated receipt.');
        doc.text('No signature is required', startX, currentY + 42);
        
        doc.font('Helvetica').fontSize(10).text('Yours in the service of Lord Krishna', 350, currentY + 15);
        
        // 4. MAHA MANTRA
        doc.moveDown(5);
        doc.font('Helvetica').fontSize(10).fillColor(iskconRed).text('Hare Krishna Hare Krishna Krishna Krishna Hare Hare Hare Rama Hare Rama Rama Rama Hare Hare', { align: 'center' });

        doc.end();
    });
}
