window.addEventListener("load", benchmark);

let farFraeHame = [120, 124, 112, 112, 84, 92, 84, 72, 76, 76, 76, 28, 76, 28, 28, 28, 76, 84, 92, 92, 84, 92, 96, 104, 104, 76, 76, 28, 76, 76, 76, 84, 92, 84, 76, 84, 92, 84, 76, 72, 56, 76, 28, 56, 28, 76, 84];

function benchmark() {
    fetchShardData().then(resources => {
        console.log(resources);
        const qe = new QueryEngineGPU(
            resources.shardData,
            resources.shardMeta,
        );

        document.getElementById("execute").addEventListener("click", () => {
            qe.query(farFraeHame).catch(console.error);
        });

        qe.initialise().catch(console.error);
    }).catch(console.error);
}

function fetchShardData() {
    let shards = loadShardPartitions(2);

    return new Promise(resolve => {
        Promise.all([
            shards,
            fetch("query-data/query-meta-data.json").then(r => {
                return r.json();
            })
        ]).then(([shardData, shardMeta]) => {
            resolve({
                shardData: shardData,
                shardMeta: shardMeta
            });
        }).catch(console.error);
    });
}

function loadShardPartitions(numPartitions) {
    let partitionPromises = [];
    for(let i = 0; i < numPartitions; i++) {
        partitionPromises.push(loadShardPartition(i))
    }
    return Promise.all(partitionPromises);
}

function loadShardPartition(partitionNum) {
    // Fragment is a URL to a .png file
    let image = new Image();
    return new Promise(resolve => {
        image.src = `/query-data/query-data-${partitionNum}.png`;
        image.onload = () => resolve(image);
    });
}