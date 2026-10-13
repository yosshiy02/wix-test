using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;

namespace HDOriginPortableGitSync
{
    internal static class Program
    {
        private sealed class CommandResult
        {
            public int ExitCode;
            public string StdOut;
            public string StdErr;
        }

        private static string TrimDirectory(string value)
        {
            if (String.IsNullOrEmpty(value))
            {
                return value;
            }

            return value.TrimEnd(
                Path.DirectorySeparatorChar,
                Path.AltDirectorySeparatorChar
            );
        }

        private static string ResolveProjectRoot()
        {
            string baseDir =
                TrimDirectory(
                    AppDomain.CurrentDomain.BaseDirectory
                );

            DirectoryInfo current =
                new DirectoryInfo(baseDir);

            while (current != null)
            {
                string runtime =
                    Path.Combine(
                        current.FullName,
                        "HD_ORIGIN_RUNTIME_PATHS.txt"
                    );

                string webDir =
                    Path.Combine(
                        current.FullName,
                        "web_receiver"
                    );

                if (
                    File.Exists(runtime) &&
                    Directory.Exists(webDir)
                )
                {
                    return current.FullName;
                }

                current = current.Parent;
            }

            throw new DirectoryNotFoundException(
                "HD Origin Project root could not be resolved from launcher location."
            );
        }

        private static Dictionary<string, string> ReadKeyValueFile(
            string path
        )
        {
            Dictionary<string, string> result =
                new Dictionary<string, string>(
                    StringComparer.OrdinalIgnoreCase
                );

            if (!File.Exists(path))
            {
                return result;
            }

            foreach (string rawLine in File.ReadAllLines(path))
            {
                string line =
                    rawLine == null
                        ? ""
                        : rawLine.Trim();

                if (line.Length == 0)
                {
                    continue;
                }

                if (line.StartsWith("#"))
                {
                    continue;
                }

                int pos =
                    line.IndexOf('=');

                if (pos < 1)
                {
                    continue;
                }

                string key =
                    line.Substring(0, pos).Trim();

                string value =
                    line.Substring(pos + 1).Trim();

                if (key.Length > 0)
                {
                    result[key] = value;
                }
            }

            return result;
        }

        private static string GetRuntimeValue(
            Dictionary<string, string> runtime,
            string key
        )
        {
            string value;

            if (
                runtime != null &&
                runtime.TryGetValue(key, out value)
            )
            {
                return value == null
                    ? ""
                    : value.Trim().Trim('"');
            }

            return "";
        }

        private static string FindOnPath(
            string exeName
        )
        {
            string pathValue =
                Environment.GetEnvironmentVariable(
                    "PATH"
                );

            if (String.IsNullOrWhiteSpace(pathValue))
            {
                return "";
            }

            string[] parts =
                pathValue.Split(
                    new char[] { ';' },
                    StringSplitOptions.RemoveEmptyEntries
                );

            foreach (string rawPart in parts)
            {
                try
                {
                    string part =
                        rawPart.Trim().Trim('"');

                    if (part.Length == 0)
                    {
                        continue;
                    }

                    string candidate =
                        Path.Combine(
                            part,
                            exeName
                        );

                    if (File.Exists(candidate))
                    {
                        return Path.GetFullPath(candidate);
                    }
                }
                catch
                {
                }
            }

            return "";
        }

        private static void AddCandidate(
            List<string> list,
            string path
        )
        {
            if (String.IsNullOrWhiteSpace(path))
            {
                return;
            }

            try
            {
                string full =
                    Path.GetFullPath(
                        path.Trim().Trim('"')
                    );

                foreach (string existing in list)
                {
                    if (
                        String.Equals(
                            existing,
                            full,
                            StringComparison.OrdinalIgnoreCase
                        )
                    )
                    {
                        return;
                    }
                }

                list.Add(full);
            }
            catch
            {
            }
        }

        private static string ResolveGitExe(
            string projectRoot,
            Dictionary<string, string> runtime
        )
        {
            List<string> candidates =
                new List<string>();

            AddCandidate(
                candidates,
                GetRuntimeValue(
                    runtime,
                    "GIT_EXE"
                )
            );

            AddCandidate(
                candidates,
                GetRuntimeValue(
                    runtime,
                    "GIT_PATH"
                )
            );

            AddCandidate(
                candidates,
                FindOnPath(
                    "git.exe"
                )
            );

            string projectDrive =
                Path.GetPathRoot(
                    projectRoot
                );

            if (!String.IsNullOrWhiteSpace(projectDrive))
            {
                AddCandidate(
                    candidates,
                    Path.Combine(
                        projectDrive,
                        "Apps",
                        "Git",
                        "cmd",
                        "git.exe"
                    )
                );

                AddCandidate(
                    candidates,
                    Path.Combine(
                        projectDrive,
                        "Git",
                        "cmd",
                        "git.exe"
                    )
                );
            }

            string programFiles =
                Environment.GetFolderPath(
                    Environment.SpecialFolder.ProgramFiles
                );

            if (!String.IsNullOrWhiteSpace(programFiles))
            {
                AddCandidate(
                    candidates,
                    Path.Combine(
                        programFiles,
                        "Git",
                        "cmd",
                        "git.exe"
                    )
                );
            }

            string programFilesX86 =
                Environment.GetFolderPath(
                    Environment.SpecialFolder.ProgramFilesX86
                );

            if (!String.IsNullOrWhiteSpace(programFilesX86))
            {
                AddCandidate(
                    candidates,
                    Path.Combine(
                        programFilesX86,
                        "Git",
                        "cmd",
                        "git.exe"
                    )
                );
            }

            foreach (DriveInfo drive in DriveInfo.GetDrives())
            {
                try
                {
                    if (!drive.IsReady)
                    {
                        continue;
                    }

                    AddCandidate(
                        candidates,
                        Path.Combine(
                            drive.RootDirectory.FullName,
                            "Apps",
                            "Git",
                            "cmd",
                            "git.exe"
                        )
                    );

                    AddCandidate(
                        candidates,
                        Path.Combine(
                            drive.RootDirectory.FullName,
                            "Git",
                            "cmd",
                            "git.exe"
                        )
                    );

                    AddCandidate(
                        candidates,
                        Path.Combine(
                            drive.RootDirectory.FullName,
                            "Program Files",
                            "Git",
                            "cmd",
                            "git.exe"
                        )
                    );

                    AddCandidate(
                        candidates,
                        Path.Combine(
                            drive.RootDirectory.FullName,
                            "Program Files (x86)",
                            "Git",
                            "cmd",
                            "git.exe"
                        )
                    );
                }
                catch
                {
                }
            }

            foreach (string candidate in candidates)
            {
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }

            throw new FileNotFoundException(
                "git.exe could not be resolved on this PC."
            );
        }

        private static CommandResult RunGit(
            string gitExe,
            string projectRoot,
            string arguments,
            bool showOutput
        )
        {
            ProcessStartInfo info =
                new ProcessStartInfo();

            info.FileName =
                gitExe;

            info.Arguments =
                arguments;

            info.WorkingDirectory =
                projectRoot;

            info.UseShellExecute =
                false;

            info.CreateNoWindow =
                false;

            info.RedirectStandardOutput =
                true;

            info.RedirectStandardError =
                true;

            Process process =
                new Process();

            process.StartInfo =
                info;

            Console.WriteLine();
            Console.WriteLine(
                "GIT> git " + arguments
            );

            process.Start();

            string stdout =
                process.StandardOutput.ReadToEnd();

            string stderr =
                process.StandardError.ReadToEnd();

            process.WaitForExit();

            if (showOutput)
            {
                if (!String.IsNullOrWhiteSpace(stdout))
                {
                    Console.WriteLine(
                        stdout.TrimEnd()
                    );
                }

                if (!String.IsNullOrWhiteSpace(stderr))
                {
                    Console.WriteLine(
                        stderr.TrimEnd()
                    );
                }
            }

            Console.WriteLine(
                "GIT_EXIT=" +
                process.ExitCode
            );

            CommandResult result =
                new CommandResult();

            result.ExitCode =
                process.ExitCode;

            result.StdOut =
                stdout == null
                    ? ""
                    : stdout;

            result.StdErr =
                stderr == null
                    ? ""
                    : stderr;

            return result;
        }

        private static void RequireSuccess(
            string command,
            CommandResult result
        )
        {
            if (result.ExitCode == 0)
            {
                return;
            }

            throw new Exception(
                "Git command failed: " +
                command +
                Environment.NewLine +
                result.StdErr
            );
        }

        private static int Main(
            string[] args
        )
        {
            try
            {
                Console.OutputEncoding =
                    System.Text.Encoding.UTF8;

                string projectRoot =
                    ResolveProjectRoot();

                string webDir =
                    Path.Combine(
                        projectRoot,
                        "web_receiver"
                    );

                string runtimePath =
                    Path.Combine(
                        projectRoot,
                        "HD_ORIGIN_RUNTIME_PATHS.txt"
                    );

                Dictionary<string, string> runtime =
                    ReadKeyValueFile(
                        runtimePath
                    );

                string gitExe =
                    ResolveGitExe(
                        projectRoot,
                        runtime
                    );

                Console.WriteLine(
                    "============================================================"
                );

                Console.WriteLine(
                    "HD ORIGIN PORTABLE GIT SYNC"
                );

                Console.WriteLine(
                    "============================================================"
                );

                Console.WriteLine(
                    "COMPUTER=" +
                    Environment.MachineName
                );

                Console.WriteLine(
                    "PROJECT_ROOT=" +
                    projectRoot
                );

                Console.WriteLine(
                    "WEB_DIR=" +
                    webDir
                );

                Console.WriteLine(
                    "GIT_EXE=" +
                    gitExe
                );

                Console.WriteLine(
                    "CMD_EXE_USED_FOR_GIT=NO"
                );

                Console.WriteLine(
                    "MACHINE_PATH_HARDCODE=NO"
                );

                if (
                    args != null &&
                    args.Length > 0 &&
                    String.Equals(
                        args[0],
                        "--self-test",
                        StringComparison.OrdinalIgnoreCase
                    )
                )
                {
                    Console.WriteLine(
                        "STATUS=SELF_TEST_OK"
                    );

                    return 0;
                }

                CommandResult inside =
                    RunGit(
                        gitExe,
                        projectRoot,
                        "rev-parse --is-inside-work-tree",
                        false
                    );

                RequireSuccess(
                    "rev-parse --is-inside-work-tree",
                    inside
                );

                if (
                    !String.Equals(
                        inside.StdOut.Trim(),
                        "true",
                        StringComparison.OrdinalIgnoreCase
                    )
                )
                {
                    throw new Exception(
                        "PROJECT_ROOT is not inside a Git work tree."
                    );
                }

                CommandResult branchResult =
                    RunGit(
                        gitExe,
                        projectRoot,
                        "branch --show-current",
                        false
                    );

                RequireSuccess(
                    "branch --show-current",
                    branchResult
                );

                string branch =
                    branchResult.StdOut.Trim();

                if (String.IsNullOrWhiteSpace(branch))
                {
                    throw new Exception(
                        "Current Git branch could not be resolved."
                    );
                }

                Console.WriteLine(
                    "BRANCH=" +
                    branch
                );

                CommandResult fetch =
                    RunGit(
                        gitExe,
                        projectRoot,
                        "fetch origin",
                        true
                    );

                RequireSuccess(
                    "fetch origin",
                    fetch
                );

                string pullCommand =
                    "pull --rebase --autostash origin " +
                    branch;

                CommandResult pull =
                    RunGit(
                        gitExe,
                        projectRoot,
                        pullCommand,
                        true
                    );

                if (pull.ExitCode != 0)
                {
                    RunGit(
                        gitExe,
                        projectRoot,
                        "rebase --abort",
                        false
                    );

                    RequireSuccess(
                        pullCommand,
                        pull
                    );
                }

                string pushCommand =
                    "push -u origin " +
                    branch;

                CommandResult push =
                    RunGit(
                        gitExe,
                        projectRoot,
                        pushCommand,
                        true
                    );

                RequireSuccess(
                    pushCommand,
                    push
                );

                CommandResult finalFetch =
                    RunGit(
                        gitExe,
                        projectRoot,
                        "fetch origin",
                        true
                    );

                RequireSuccess(
                    "fetch origin",
                    finalFetch
                );

                string verifyCommand =
                    "rev-list --left-right --count origin/" +
                    branch +
                    "..." +
                    branch;

                CommandResult verify =
                    RunGit(
                        gitExe,
                        projectRoot,
                        verifyCommand,
                        false
                    );

                RequireSuccess(
                    verifyCommand,
                    verify
                );

                string[] counts =
                    verify.StdOut
                        .Trim()
                        .Split(
                            new char[]
                            {
                                ' ',
                                '\t',
                                '\r',
                                '\n'
                            },
                            StringSplitOptions.RemoveEmptyEntries
                        );

                if (counts.Length < 2)
                {
                    throw new Exception(
                        "Git divergence count could not be parsed: " +
                        verify.StdOut
                    );
                }

                Console.WriteLine(
                    "REMOTE_ONLY=" +
                    counts[0]
                );

                Console.WriteLine(
                    "LOCAL_ONLY=" +
                    counts[1]
                );

                if (
                    counts[0] != "0" ||
                    counts[1] != "0"
                )
                {
                    throw new Exception(
                        "GitHub and local source are not synchronized."
                    );
                }

                Console.WriteLine(
                    "GIT_SYNC=OK"
                );

                Console.WriteLine(
                    "STATUS=SUCCESS"
                );

                return 0;
            }
            catch (Exception ex)
            {
                Console.WriteLine();
                Console.WriteLine(
                    "============================================================"
                );

                Console.WriteLine(
                    "ERROR"
                );

                Console.WriteLine(
                    "============================================================"
                );

                Console.WriteLine(
                    "STATUS=ERROR"
                );

                Console.WriteLine(
                    ex.ToString()
                );

                return 1;
            }
        }
    }
}