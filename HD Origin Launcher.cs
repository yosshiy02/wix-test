using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;

public static class HdOriginLauncher
{
    [STAThread]
    public static int Main(string[] args)
    {
        try
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            string batPath = FindStartBat(exeDir);

            if (string.IsNullOrWhiteSpace(batPath))
            {
                MessageBox.Show(
                    "start_hd_origin.bat が見つかりません。\n\n" +
                    "HD Origin Launcher.exe は、hd-origin-project フォルダの隣に置いてください。\n\n" +
                    "想定場所:\n" +
                    "hd-origin-project\\web_receiver\\start_hd_origin.bat",
                    "HD Origin Launcher",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return 1;
            }

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = batPath;
            psi.WorkingDirectory = Path.GetDirectoryName(batPath);
            psi.UseShellExecute = true;

            Process.Start(psi);
            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                ex.Message,
                "HD Origin Launcher",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return 1;
        }
    }

    private static string FindStartBat(string startDir)
    {
        string dir = Path.GetFullPath(startDir);

        for (int i = 0; i < 10; i++)
        {
            string directBat = Path.Combine(dir, "web_receiver", "start_hd_origin.bat");

            if (File.Exists(directBat))
            {
                return directBat;
            }

            string childBat = Path.Combine(dir, "hd-origin-project", "web_receiver", "start_hd_origin.bat");

            if (File.Exists(childBat))
            {
                return childBat;
            }

            DirectoryInfo parent = Directory.GetParent(dir);
            if (parent == null) break;

            dir = parent.FullName;
        }

        return null;
    }
}