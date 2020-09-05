
function main() {
    fetch('/query-data.txt')
        .then(r => r.text())
        .then(r => {
            // console.log(r);
            const lines = r.split('\n');
            // console.debug(lines);
            const lookupTable = buildHeuristicsTable(lines);
            const tunesLookup = buildHeuristicsTableAlt(lines);

            console.debug(JSON.stringify(lookupTable));

            const query = "DDCAyyyyyvyAAAyvtroooooooooACDDDDDHCCCAyCAA";
            heuristicQuery(query, lookupTable);
            heuristicQueryAlt(query, tunesLookup);
        })
}

function buildHeuristicsTable(lines) {
    const lookupTable = {};

    console.time('Build heuristics table');
    for(let i = 0; i < lines.length; i++) {
        for(let j = 0; j < 62; j++) {
            let k = lines[i].substring(j, j + 3);
            if(lookupTable.hasOwnProperty(k)) {
                lookupTable[k].push(i);
            } else {
                lookupTable[k] = [];
            }
        }
    }
    console.timeEnd('Build heuristics table');
    console.debug(Object.keys(lookupTable).length);
    console.debug(lookupTable);
    return lookupTable;
}


function buildHeuristicsTableAlt(lines) {
    const kTups = {};
    const tunes = [];
    let index = 0;

    console.time('Build heuristics table alt');
    for(let i = 0; i < lines.length; i++) {
        let tune = [];
        for(let j = 0; j < 62; j++) {
            let k = lines[i].substring(j, j + 3);
            let id;
            if(kTups.hasOwnProperty(k)) {
                id = kTups[k];
            } else {
                id = index;
                kTups[k] = index;
                index++;
            }
            tune.push(id);
        }
        tunes.push(tune);
    }
    console.timeEnd('Build heuristics table alt');
    console.debug(tunes.length);
    return tunes;
}


function heuristicQuery(q, table) {
    let hits = []
    console.log(table);

    console.time('Heuristic Query');
    for(let i = 0; i < q.length - 3; i++) {
        let k = q.substring(i, i + 3);
        hits.push(table[k]);
    }
    console.timeEnd('Heuristic Query');
    console.debug(hits);
}


function heuristicQueryAlt(q, table) {
    let hits = []

    console.time('Heuristic Query alt');
    for(let i = 0; i < q.length - 3; i++) {
        let k = q.substring(i, i + 3);
        for(let j = 0; j < table.length; j++) {
            if(table[j].includes(k)) {
                hits.push(table[j]);
            }
        }
    }
    console.timeEnd('Heuristic Query alt');
    console.debug(hits);
}



window.addEventListener("load", () => {
    console.debug("loaded");
    main();
});