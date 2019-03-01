import { ChildProcess } from "child_process";

class ChildProcessHelper {
    private readonly process: ChildProcess;
    private readonly exit$: Promise<void>;

    constructor(process: ChildProcess) {
        this.process = process;

        let exitResolve: () => void;

        this.exit$ = new Promise<void>(resolve => {
            exitResolve = resolve;
        });

        process.on("exit", () => {
            exitResolve();
        });
    }

    waitExit(): Promise<void> {
        return this.exit$;
    }
}

export { ChildProcessHelper }
