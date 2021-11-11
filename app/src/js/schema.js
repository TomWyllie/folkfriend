export class HistoryItem {
    constructor(result) {
        this.result = result;
        this.timestamp = Date.now();
    }
}