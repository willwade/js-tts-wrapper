// Basic type declaration for the custom-built espeakng WASM module

declare module '../../wasm/espeakng/espeakng.js' {
    // Define the shape of the object returned by the WASM module factory
    interface EspeakNGModule {
        // Add other expected Emscripten methods/properties here if needed
        FS: any; // Emscripten Filesystem API (use 'any' for simplicity)
        callMain: (args: string[]) => void; // Function to run main() with arguments
        print?: (text: string) => void; // Optional print function (if exposed)
        printErr?: (text: string) => void; // Optional printErr function (if exposed)
        // Add other properties like HEAP, ccall, cwrap if needed
        [key: string]: any; // Allow other properties
    }

    // Define the type of the default export (the module factory function)
    // It accepts an optional configuration object (e.g., for print/printErr)
    type EspeakNGFactory = (moduleOverrides?: Partial<EspeakNGModule>) => Promise<EspeakNGModule>;

    const factory: EspeakNGFactory;
    export default factory;
}
