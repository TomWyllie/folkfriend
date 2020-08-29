window.addEventListener("load", benchmark);

function benchmark() {
    // const qe = new QueryEngineGPU();
    const qe = new QueryEngineCPU();
    qe.initialise().catch(console.error);
    document.getElementById("execute").addEventListener("click", () => {
        let fiddleDemo = [14, 16, 16, 18, 14, 14, 18, 19, 21, 21, 21, 16, 19, 16, 21, 16, 11, 11, 13, 14, 16, 16, 9, 9, 9, 21, 18, 18, 14, 14, 21, 19, 21, 21, 21, 21, 25, 26, 14, 26, 26, 14, 14, 25, 21];
        qe.query(fiddleDemo).catch(console.error);
    });
}
