window.addEventListener("load", queryEngineDemo);

let qeGPU;
let qeCPU;

function queryEngineDemo() {
    qeGPU = new QueryEngineGPU();
    qeGPU.initialise().catch(console.error);

    qeCPU = new QueryEngineCPU();
    qeCPU.initialise().catch(console.error);

    document.getElementById("execute").addEventListener("click", () => {
        validityTest().catch();
    });
}

async function validityTest() {
    // "Crow Road Croft"
    //  This example was
    let fiddleDemo = [14, 16, 16, 18, 14, 14, 18, 19, 21, 21, 21, 16, 19, 16, 21, 16, 11, 11, 13, 14, 16, 16, 9, 9, 9, 21, 18, 18, 14, 14, 21, 19, 21, 21, 21, 21, 25, 26, 14, 26, 26, 14, 14, 25, 21];
    let t0, perf;

    t0 = performance.now();
    await qeCPU.query(fiddleDemo).catch(console.error);
    perf = performance.now() - t0;
    result(perf);

    t0 = performance.now();
    await qeGPU.query(fiddleDemo).catch(console.error);
    perf = performance.now() - t0;
    result(perf);

    if(FFDebug) {
        let match = 0;
        for(let i = 0; i < qeCPU.shardScores.length; i++) {
            if(qeCPU.shardScores[i] === qeGPU.shardScores[i]) {
                match += 1;
            }
        }
        let accuracy = `${match} / ${qeCPU.shardScores.length}`;
        result(accuracy);
    }
}

function result(x) {
    let s = document.createElement("p");
    s.textContent = `${x}`;
    document.body.appendChild(s);
}
