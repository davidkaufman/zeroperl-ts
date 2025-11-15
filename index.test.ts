import { describe, expect, it } from "bun:test";
import { ZeroPerl, MemoryFileSystem } from "./index";

describe("ZeroPerl", () => {
    it("should evaluate basic Perl code", async () => {
        const perl = await ZeroPerl.create({
            stdout: (data) => console.log(data),
            stderr: (data) => console.error(data)
        });
        
        const result = await perl.eval('$x = 42');
        expect(result.success).toBe(true);
        expect(result.exitCode).toBe(0);
        
        await perl.dispose();
    });

    it("should get and set variables", async () => {
        const perl = await ZeroPerl.create();
        
        await perl.setVariable('name', 'Alice');
        const value = await perl.getVariable('name');
        expect(value).toBe('Alice');
        
        await perl.dispose();
    });

    it("should return null for non-existent variables", async () => {
        const perl = await ZeroPerl.create();
        
        const value = await perl.getVariable('nonexistent');
        expect(value).toBeNull();
        
        await perl.dispose();
    });

    it("should evaluate code with output", async () => {
        let output = '';
        const perl = await ZeroPerl.create({
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        const result = await perl.eval('print "hello from perl"');
        await perl.flush();
        expect(result.success).toBe(true);
        expect(result.exitCode).toBe(0);
        expect(output).toBe('hello from perl');
        
        await perl.dispose();
    });

    it("should evaluate code with arguments", async () => {
        let output = '';
        const perl = await ZeroPerl.create({
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        const result = await perl.eval('print "Args: @ARGV"', ['arg1', 'arg2']);
        await perl.flush();
        expect(result.success).toBe(true);
        expect(output).toBe('Args: arg1 arg2');
        
        await perl.dispose();
    });

    it("should run a script file from filesystem", async () => {
        const fs = new MemoryFileSystem({ "/": "" });
        fs.addFile("/test.pl", 'print "Hello from file!"');
        
        let output = '';
        const perl = await ZeroPerl.create({
            fileSystem: fs,
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        const result = await perl.runFile('/test.pl');
        await perl.flush();
        expect(result.success).toBe(true);
        expect(result.exitCode).toBe(0);
        expect(output).toBe('Hello from file!');
        
        await perl.dispose();
    });

    it("should run a script file with arguments", async () => {
        const fs = new MemoryFileSystem({ "/": "" });
        fs.addFile("/script.pl", 'print "Args: @ARGV"');
        
        let output = '';
        const perl = await ZeroPerl.create({
            fileSystem: fs,
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        const result = await perl.runFile('/script.pl', ['one', 'two', 'three']);
        await perl.flush();
        expect(result.success).toBe(true);
        expect(output).toBe('Args: one two three');
        
        await perl.dispose();
    });

    it("should reset to clean state", async () => {
        const perl = await ZeroPerl.create();
        
        await perl.eval('$x = 42');
        let value = await perl.getVariable('x');
        expect(value).toBe('42');
        
        await perl.reset();
        
        value = await perl.getVariable('x');
        expect(value).toBeNull();
        
        await perl.dispose();
    });

    it("should handle errors gracefully", async () => {
        const perl = await ZeroPerl.create();
        
        const result = await perl.eval('die "test error"');
        expect(result.success).toBe(false);
        expect(result.error).toContain('test error');
        
        await perl.dispose();
    });

    it("should get last error", async () => {
        const perl = await ZeroPerl.create();
        
        await perl.eval('die "custom error"');
        const error = await perl.getLastError();
        expect(error).toContain('custom error');
        
        await perl.clearError();
        const clearedError = await perl.getLastError();
        expect(clearedError).toBe('');
        
        await perl.dispose();
    });

    it("should check initialization state", async () => {
        const perl = await ZeroPerl.create();
        
        const isInit = await perl.isInitialized();
        expect(isInit).toBe(true);
        
        const canEval = await perl.canEvaluate();
        expect(canEval).toBe(true);
        
        await perl.dispose();
    });

    it("should handle multiple evaluations", async () => {
        const perl = await ZeroPerl.create();
        
        await perl.eval('$count = 0');
        await perl.eval('$count++');
        await perl.eval('$count++');
        
        const value = await perl.getVariable('count');
        expect(value).toBe('2');
        
        await perl.dispose();
    });

    it("should work with environment variables", async () => {
        let output = '';
        const perl = await ZeroPerl.create({
            env: { MY_VAR: 'test_value' },
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        const result = await perl.eval('print $ENV{MY_VAR}');
        await perl.flush();
        expect(result.success).toBe(true);
        expect(output).toBe('test_value');
        
        await perl.dispose();
    });

    it("should run multiple files in sequence", async () => {
        const fs = new MemoryFileSystem({ "/": "" });
        fs.addFile("/first.pl", 'print "first "');
        fs.addFile("/second.pl", 'print "second"');
        
        let output = '';
        const perl = await ZeroPerl.create({
            fileSystem: fs,
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        await perl.runFile('/first.pl');
        await perl.runFile('/second.pl');
        await perl.flush();
        
        expect(output).toBe('first second');
        
        await perl.dispose();
    });

    it("should allow eval after runFile", async () => {
        const fs = new MemoryFileSystem({ "/": "" });
        fs.addFile("/script.pl", '$global = "from file"');
        
        const perl = await ZeroPerl.create({ fileSystem: fs });
        
        await perl.runFile('/script.pl');
        const value = await perl.getVariable('global');
        expect(value).toBe('from file');
        
        await perl.dispose();
    });

    it("should share state between eval and runFile", async () => {
        const fs = new MemoryFileSystem({ "/": "" });
        fs.addFile("/script.pl", 'print "x is $x"');
        
        let output = '';
        const perl = await ZeroPerl.create({
            fileSystem: fs,
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        await perl.eval('$x = 42');
        await perl.runFile('/script.pl');
        await perl.flush();
        
        expect(output).toBe('x is 42');
        
        await perl.dispose();
    });

    it("should explicitly test flush method", async () => {
        let output = '';
        const perl = await ZeroPerl.create({
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        await perl.eval('print "before flush"');
        expect(output).toBe('');
        
        await perl.flush();
        expect(output).toBe('before flush');
        
        await perl.eval('print " after flush"');
        await perl.flush();
        expect(output).toBe('before flush after flush');
        
        await perl.dispose();
    });

    it("should use shutdown for complete cleanup", async () => {
        const perl = await ZeroPerl.create();
        
        await perl.eval('$x = 42');
        const value = await perl.getVariable('x');
        expect(value).toBe('42');
        
        await perl.shutdown();
        
        // After shutdown, instance should be disposed
        expect(async () => {
            await perl.eval('$y = 10');
        }).toThrow();
    });

    it("should throw error when using disposed instance", async () => {
        const perl = await ZeroPerl.create();
        await perl.dispose();
        
        expect(async () => {
            await perl.eval('$x = 1');
        }).toThrow('ZeroPerl instance has been disposed');
    });

    it("should handle empty arguments array", async () => {
        let output = '';
        const perl = await ZeroPerl.create({
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        const result = await perl.eval('print "Args: @ARGV"', []);
        await perl.flush();
        expect(result.success).toBe(true);
        expect(output).toBe('Args: ');
        
        await perl.dispose();
    });

    it("should handle file not found error", async () => {
        const fs = new MemoryFileSystem({ "/": "" });
        const perl = await ZeroPerl.create({ fileSystem: fs });
        
        const result = await perl.runFile('/nonexistent.pl');
        expect(result.success).toBe(false);
        const error = await perl.getLastError();
        expect(error).toEqual('File not found');

        await perl.dispose();
    });

    it("should clear error state properly", async () => {
        const perl = await ZeroPerl.create();
        
        // Generate an error
        await perl.eval('die "first error"');
        let error = await perl.getLastError();
        expect(error).toContain('first error');
        
        // Clear it
        await perl.clearError();
        error = await perl.getLastError();
        expect(error).toBe('');
        
        // Successful eval shouldn't set error
        await perl.eval('$x = 42');
        error = await perl.getLastError();
        expect(error).toBe('');
        
        await perl.dispose();
    });

    it("should handle multiple variable operations", async () => {
        const perl = await ZeroPerl.create();
        
        await perl.setVariable('var1', 'value1');
        await perl.setVariable('var2', 'value2');
        await perl.setVariable('var3', 'value3');
        
        expect(await perl.getVariable('var1')).toBe('value1');
        expect(await perl.getVariable('var2')).toBe('value2');
        expect(await perl.getVariable('var3')).toBe('value3');
        
        // Overwrite
        await perl.setVariable('var1', 'new_value');
        expect(await perl.getVariable('var1')).toBe('new_value');
        
        await perl.dispose();
    });

    it("should maintain state after error", async () => {
        const perl = await ZeroPerl.create();
        
        await perl.eval('$x = 42');
        
        // Cause an error
        await perl.eval('die "error"');
        
        // State should still exist
        const value = await perl.getVariable('x');
        expect(value).toBe('42');
        
        await perl.dispose();
    });

    it("should handle stderr output separately", async () => {
        let stdoutData = '';
        let stderrData = '';
        
        const perl = await ZeroPerl.create({
            stdout: (data) => {
                stdoutData += typeof data === 'string' ? data : new TextDecoder().decode(data);
            },
            stderr: (data) => {
                stderrData += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        await perl.eval('print "to stdout"; warn "to stderr"');
        await perl.flush();
        
        expect(stdoutData).toBe('to stdout');
        expect(stderrData).toContain('to stderr');
        
        await perl.dispose();
    });

    it("should handle complex Perl expressions", async () => {
        const perl = await ZeroPerl.create();
        
        await perl.eval(`
            @array = (1, 2, 3, 4, 5);
            $sum = 0;
            foreach my $num (@array) {
                $sum += $num;
            }
        `);
        
        const sum = await perl.getVariable('sum');
        expect(sum).toBe('15');
        
        await perl.dispose();
    });

    it("should support reading files from virtual filesystem", async () => {
        const fs = new MemoryFileSystem({ "/": "" });
        fs.addFile("/data.txt", "Hello from file system!");
        
        let output = '';
        const perl = await ZeroPerl.create({
            fileSystem: fs,
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        await perl.eval(`
            open my $fh, '<', '/data.txt' or die $!;
            my $content = <$fh>;
            print $content;
            close $fh;
        `);
        await perl.flush();
        
        expect(output).toBe('Hello from file system!');
        
        await perl.dispose();
    });

    it("should handle reset after error", async () => {
        const perl = await ZeroPerl.create();
        
        await perl.eval('$x = 42');
        await perl.eval('die "error"');
        
        const errorBefore = await perl.getLastError();
        expect(errorBefore).toContain('error');
        
        await perl.reset();
        
        const errorAfter = await perl.getLastError();
        expect(errorAfter).toBe('');
        
        const value = await perl.getVariable('x');
        expect(value).toBeNull();
        
        await perl.dispose();
    });

    it("should handle asynchronous file reading from File", async () => {
        const fs = new MemoryFileSystem({ "/": "" });
        
        // Create a File with file content
        const fileContent = "Asynchronously loaded content from File!";
        const file = new File([fileContent], "async-data.txt", { type: 'text/plain' });
        
        // Add the File to the filesystem
        fs.addFile("/async-data.txt", file);
        
        let output = '';
        const perl = await ZeroPerl.create({
            fileSystem: fs,
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        // Read the file in Perl - this should trigger async read of the File
        await perl.eval(`
            open my $fh, '<', '/async-data.txt' or die $!;
            my $content = <$fh>;
            print $content;
            close $fh;
        `);
        await perl.flush();
        
        expect(output).toBe(fileContent);
        
        await perl.dispose();
    });

    it("should handle multiple asynchronous file reads with File and Blob", async () => {
        const fs = new MemoryFileSystem({ "/": "" });
        
        // Create mix of File and Blob objects
        const file1 = new File(["First async file"], "file1.txt", { type: 'text/plain' });
        const blob2 = new Blob(["Second async file"], { type: 'text/plain' });
        const file3 = new File(["Third async file"], "file3.txt", { type: 'text/plain' });
        
        fs.addFile("/file1.txt", file1);
        fs.addFile("/file2.txt", blob2);
        fs.addFile("/file3.txt", file3);
        
        let output = '';
        const perl = await ZeroPerl.create({
            fileSystem: fs,
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        // Read all files sequentially
        await perl.eval(`
            foreach my $file ('/file1.txt', '/file2.txt', '/file3.txt') {
                open my $fh, '<', $file or die $!;
                my $content = <$fh>;
                print $content . " ";
                close $fh;
            }
        `);
        await perl.flush();
        
        expect(output).toBe("First async file Second async file Third async file ");
        
        await perl.dispose();
    });

    it("should handle large Blob reads asynchronously", async () => {
        const fs = new MemoryFileSystem({ "/": "" });
        
        // Create a larger Blob to test async behavior with more data
        const largeContent = "x".repeat(10000) + "\nEND";
        const largeBlob = new Blob([largeContent], { type: 'text/plain' });
        
        fs.addFile("/large-file.txt", largeBlob);
        
        let output = '';
        const perl = await ZeroPerl.create({
            fileSystem: fs,
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        // Read the entire file
        await perl.eval(`
            open my $fh, '<', '/large-file.txt' or die $!;
            my $content = do { local $/; <$fh> };
            my @lines = split /\\n/, $content;
            print $lines[-1];  # Print last line
            close $fh;
        `);
        await perl.flush();
        
        expect(output).toBe("END");
        
        await perl.dispose();
    });

    it("should handle File objects with metadata", async () => {
        const fs = new MemoryFileSystem({ "/": "" });
        
        // Create a File with metadata
        const content = "Content with metadata";
        const lastModified = Date.now();
        const file = new File([content], "metadata.txt", { 
            type: 'text/plain',
            lastModified 
        });
        
        fs.addFile("/metadata.txt", file);
        
        let output = '';
        const perl = await ZeroPerl.create({
            fileSystem: fs,
            stdout: (data) => {
                output += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }
        });
        
        await perl.eval(`
            open my $fh, '<', '/metadata.txt' or die $!;
            my $content = <$fh>;
            print $content;
            close $fh;
        `);
        await perl.flush();
        
        expect(output).toBe(content);
        
        await perl.dispose();
    });
});