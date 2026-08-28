// PIX EMV-QRC generator
// Formatting as per Banco Central do Brasil specs

export function generatePixPayload(
    pixKey: string,
    amount: number,
    merchantName: string = 'Horium App',
    merchantCity: string = 'Sao Paulo',
    txid: string = 'HORIUM'
) {
    const pad = (str: string, length: number = 2) => String(str).padStart(length, '0');

    const payloadFormatIndicator = "000201";

    const gui = "br.gov.bcb.pix";
    const keyMsg = `01${pad(String(pixKey.length))}${pixKey}`;
    const merchantAccountInfo = `26${pad(String(gui.length + keyMsg.length + 4))}0014${gui}${keyMsg}`;

    const merchantCategoryCode = "52040000";
    const transactionCurrency = "5303986";
    const amountStr = amount.toFixed(2);
    const transactionAmount = `54${pad(String(amountStr.length))}${amountStr}`;

    const countryCode = "5802BR";

    const cleanName = merchantName.substring(0, 25).normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '');
    const merchantNameField = `59${pad(String(cleanName.length))}${cleanName}`;

    const cleanCity = merchantCity.substring(0, 15).normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '');
    const merchantCityField = `60${pad(String(cleanCity.length))}${cleanCity}`;

    const txidMsg = `05${pad(String(txid.length))}${txid}`;
    const additionalDataField = `62${pad(String(txidMsg.length))}${txidMsg}`;

    const payload = [
        payloadFormatIndicator,
        merchantAccountInfo,
        merchantCategoryCode,
        transactionCurrency,
        transactionAmount,
        countryCode,
        merchantNameField,
        merchantCityField,
        additionalDataField,
        "6304"
    ].join('');

    const crc = crc16(payload).toString(16).toUpperCase().padStart(4, '0');
    return payload + crc;
}

function crc16(str: string): number {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
        crc &= 0xFFFF;
    }
    return crc;
}
