import { ChartJSNodeCanvas, ChartCallback } from 'chartjs-node-canvas';
import { ChartConfiguration, ChartDataset } from 'chart.js';

const colorScheme = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
    '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080',
    '#ffffff', '#000000'
]

export async function createImage(datasets: ChartDataset[], labels: string[]): Promise<Buffer> {
    const width = 600;
    const height = 400;

    const datasetsWithColors = datasets.map((dataset, index) => ({
        ...dataset,
        backgroundColor: colorScheme[index],
        borderColor: colorScheme[index]
    }))

    const configuration: ChartConfiguration = {
        type: 'line',
        data: {
            labels,
            datasets: datasetsWithColors
        },
        options: {
        },
        plugins: [{
            id: 'background-colour',
            beforeDraw: (chart) => {
                const ctx = chart.ctx;
                ctx.save();
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            }
        }]
    };

    const chartCallback: ChartCallback = (ChartJS) => {
        ChartJS.defaults.responsive = true;
        ChartJS.defaults.maintainAspectRatio = false;
    };

    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, chartCallback });
    return  chartJSNodeCanvas.renderToBuffer(configuration);
}
