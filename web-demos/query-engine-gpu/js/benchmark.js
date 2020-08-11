window.addEventListener("load", benchmark);

function benchmark() {
    const qe = new QueryEngineGPU();
    qe.initialise().catch(console.error);
    document.getElementById("execute").addEventListener("click", () => {
        let farFraeHame = [120, 124, 112, 112, 84, 92, 84, 72, 76, 76, 76, 28, 76, 28, 28, 28, 76, 84, 92, 92, 84, 92, 96, 104, 104, 76, 76, 28, 76, 76, 76, 84, 92, 84, 76, 84, 92, 84, 76, 72, 56, 76, 28, 56, 28, 76, 84];
        qe.query(farFraeHame).catch(console.error);
    });
}
