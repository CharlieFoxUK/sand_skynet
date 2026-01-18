import { createSlice } from '@reduxjs/toolkit';

/**
 * Simple ID generator (no external dependencies)
 */
const generateId = () =>
    'layer_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

/**
 * Get default parameters for each pattern type
 */
function getDefaultParams(patternType) {
    switch (patternType) {
        case 'circle':
            return { sides: 100, radius: 1, rotation: 0 };
        case 'polygon':
            return { sides: 6, radius: 1, rotation: 0 };
        case 'spiral':
            return { spiralType: 'archimedean', turns: 5, spacing: 0.15, direction: 1, samples: 50 };
        case 'rose':
            return { petals: 5, amplitude: 1, samples: 360 };
        case 'spirograph':
            return { outerRadius: 1, innerRadius: 0.3, penOffset: 0.5, rotations: 10, samples: 100 };
        case 'star':
            return { points: 5, innerRatio: 0.5, rotation: 0 };
        case 'lissajous':
            return { freqX: 3, freqY: 2, phase: 90, samples: 360 };
        default:
            return {};
    }
}

/**
 * Default layer template
 */
const createDefaultLayer = (name = 'Layer 1', patternType = 'circle') => ({
    id: generateId(),
    name,
    patternType,
    visible: true,
    params: getDefaultParams(patternType),
    transform: {
        scale: 0.8,
        rotation: 0,
        offsetX: 0,
        offsetY: 0
    }
});

const initialState = {
    layers: [createDefaultLayer('Layer 1', 'spirograph')],
    selectedLayerId: null,
    drawingName: '',
    feedrate: 2000
};

const patternBuilderSlice = createSlice({
    name: 'patternBuilder',
    initialState,
    reducers: {
        addLayer(state, action) {
            const patternType = action.payload || 'circle';
            const newLayer = createDefaultLayer(`Layer ${state.layers.length + 1}`, patternType);
            state.layers.push(newLayer);
            state.selectedLayerId = newLayer.id;
        },
        removeLayer(state, action) {
            const id = action.payload;
            state.layers = state.layers.filter(l => l.id !== id);
            if (state.selectedLayerId === id) {
                state.selectedLayerId = state.layers.length > 0 ? state.layers[0].id : null;
            }
        },
        selectLayer(state, action) {
            state.selectedLayerId = action.payload;
        },
        updateLayerParams(state, action) {
            const { id, params } = action.payload;
            const layer = state.layers.find(l => l.id === id);
            if (layer) {
                layer.params = { ...layer.params, ...params };
            }
        },
        updateLayerTransform(state, action) {
            const { id, transform } = action.payload;
            const layer = state.layers.find(l => l.id === id);
            if (layer) {
                layer.transform = { ...layer.transform, ...transform };
            }
        },
        updateLayerPatternType(state, action) {
            const { id, patternType } = action.payload;
            const layer = state.layers.find(l => l.id === id);
            if (layer) {
                layer.patternType = patternType;
                layer.params = getDefaultParams(patternType);
            }
        },
        toggleLayerVisibility(state, action) {
            const id = action.payload;
            const layer = state.layers.find(l => l.id === id);
            if (layer) {
                layer.visible = !layer.visible;
            }
        },
        renameLayer(state, action) {
            const { id, name } = action.payload;
            const layer = state.layers.find(l => l.id === id);
            if (layer) {
                layer.name = name;
            }
        },
        reorderLayers(state, action) {
            const { fromIndex, toIndex } = action.payload;
            const [removed] = state.layers.splice(fromIndex, 1);
            state.layers.splice(toIndex, 0, removed);
        },
        setDrawingName(state, action) {
            state.drawingName = action.payload;
        },
        setFeedrate(state, action) {
            state.feedrate = action.payload;
        },
        resetPattern(state) {
            return initialState;
        }
    }
});

export const {
    addLayer,
    removeLayer,
    selectLayer,
    updateLayerParams,
    updateLayerTransform,
    updateLayerPatternType,
    toggleLayerVisibility,
    renameLayer,
    reorderLayers,
    setDrawingName,
    setFeedrate,
    resetPattern
} = patternBuilderSlice.actions;

export default patternBuilderSlice.reducer;
