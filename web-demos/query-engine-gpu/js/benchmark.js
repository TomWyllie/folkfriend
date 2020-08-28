window.addEventListener("load", benchmark);

function benchmark() {
    // const qe = new QueryEngineGPU();
    const qe = new QueryEngineCPU();
    qe.initialise().catch(console.error);
    document.getElementById("execute").addEventListener("click", () => {
        let lemonSpade = [22, 24, 22, 26, 29, 31, 27, 26, 24, 22, 19, 21, 19, 15, 14, 19, 22, 24, 22, 24, 22, 26, 29, 26, 24, 26, 24, 22];
        qe.query(lemonSpade).catch(console.error);
    });
}
