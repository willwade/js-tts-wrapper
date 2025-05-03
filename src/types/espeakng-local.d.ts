// Type declaration for the local custom-built espeakng WASM module package
declare module '@local/espeakng' {
    // Define the shape of the object returned by the WASM module factory
    interface EspeakNGModule {
        FS: any; // Emscripten Filesystem API
        callMain: (args: string[]) => void; // Function to run main() with arguments
        print?: (text: string) => void; // Optional print function
        printErr?: (text: string) => void; // Optional printErr function
        [key: string]: any; // Allow other properties
    }
    // Define the type of the default export (the module factory function)
    type EspeakNGFactory = (moduleOverrides?: Partial<EspeakNGModule>) => Promise<EspeakNGModule>;

    const factory: EspeakNGFactory;
    export default factory;
}
