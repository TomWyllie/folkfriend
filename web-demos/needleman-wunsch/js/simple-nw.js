function NWSimple(A, B) {
    const matchScore = 2;
    const mismatchScore = -2;
    const gapScore = -1;

    if(A.length > B.length) {
        let temp = A;
        A = B;
        B = temp;
    }

    let thisRow = new Int16Array(A.length + 1);
    let lastRow = new Int16Array(A.length + 1);
    lastRow.fill(0);

    //      A1 A2 A3 .. AN
    //   B1
    //   B2
    //   B3
    //   ..
    //   BN

    for(let row = 0; row < B.length; row++) {
        thisRow[0] = 0;
        for(let col = 1; col < thisRow.length; col++) {
            thisRow[col] = Math.max(
            // (A[col - 1] === B[row] ? 2 : -1),
            lastRow[col - 1] + (A[col - 1] === B[row] ? matchScore : mismatchScore),
                thisRow[col - 1] + gapScore,
                lastRow[col] + gapScore
            );
        }
        thisRow[thisRow.length - 1] = Math.max(thisRow[thisRow.length - 1], lastRow[lastRow.length - 1]);
        // console.log(lastRow.join('\t'));
        lastRow = thisRow.slice();
    }
    // console.log(lastRow.join('\t'));

    return Math.max(...lastRow);
}


function NWSimpleSingleBuffer(A, B) {
// export function NWSimpleSingleBuffer(A, B) {
    const matchScore = 2;
    const mismatchScore = -2;
    const gapScore = -1;

    if(A.length > B.length) {
        let temp = A;
        A = B;
        B = temp;
    }

    let lastRow = new Int16Array(A.length + 1);
    lastRow.fill(0);
    // console.log(lastRow.join('\t'));

    //      A1 A2 A3 .. AN
    //   B1
    //   B2
    //   B3
    //   ..
    //   BN

    lastRow[0] = 0;
    let lastDiag = 0;
    let currDiag = 0;
    for(let row = 0; row < B.length; row++) {
        lastDiag = 0;
        for(let col = 1; col < lastRow.length; col++) {
            currDiag = lastDiag;
            lastDiag = lastRow[col];

            // console.log(lastRow[col], currDiag, lastRow[col - 1]);

            lastRow[col] = Math.max(
            currDiag + (A[col - 1] === B[row] ? matchScore : mismatchScore),
                lastRow[col - 1] + gapScore,
                lastRow[col] + gapScore
            );
        }
        lastRow[lastRow.length - 1] = Math.max(lastRow[lastRow.length - 1], lastDiag);
        // thisRow[thisRow.length - 1] = Math.max(thisRow[thisRow.length - 1], lastRow[lastRow.length - 1]);
        // console.log(lastRow.join('\t'));
        // lastRow = thisRow.slice();
    }
    // console.log(lastRow);

    return Math.max(...lastRow);
}