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
    let demoMidis = document.getElementById("text-area").value;
    let fiddleDemo = JSON.parse(demoMidis);
    let t0, perf;

    t0 = performance.now();
    await qeCPU.query(fiddleDemo).catch(console.error);
    perf = performance.now() - t0;
    result(perf);

    t0 = performance.now();
    const gpuResult = await qeGPU.query(fiddleDemo).catch(console.error);
    perf = performance.now() - t0;
    result(perf);

    console.debug(gpuResult);

    if(FFConfig.debug) {
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
