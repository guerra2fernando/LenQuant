# GitHub Repository Rename Guide

Complete guide to renaming your GitHub repository from the old name to `lenquant`.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step-by-Step Renaming Process](#step-by-step-renaming-process)
3. [Update Local Repository](#update-local-repository)
4. [Update Team Members](#update-team-members)
5. [Update Documentation](#update-documentation)
6. [Verification](#verification)
7. [Important Notes](#important-notes)

---

## Prerequisites

Before renaming your repository:

- ✅ **Backup your code**: Ensure you have a local backup or clone
- ✅ **Admin access**: You need admin permissions on the GitHub repository
- ✅ **Notify team**: Inform all collaborators about the upcoming change
- ✅ **Check integrations**: List all services connected to your repo (CI/CD, hosting, etc.)

---

## Step-by-Step Renaming Process

### Step 1: Rename on GitHub

1. **Navigate to Repository Settings**:
   - Go to your repository on GitHub
   - Click on **Settings** tab (top right)
   - Scroll down to **Repository name** section

2. **Change the Name**:
   - In the "Repository name" field, enter: `lenquant`
   - Click **Rename** button
   - GitHub will show a confirmation dialog about the impact
   - Click **I understand, rename this repository**

3. **Automatic Redirect**:
   - GitHub automatically sets up redirects from the old URL to the new URL
   - This helps prevent broken links temporarily
   - **Important**: Don't rely on these redirects long-term

### Step 2: Update Remote URL in Local Repository

After renaming on GitHub, update your local repository:

**Option A: Using Git Command (Recommended)**

```bash
# Navigate to your repository
cd /path/to/lenxys-trader

# Check current remote URL
git remote -v

# Update remote URL (replace YOUR_USERNAME and OLD_NAME)
git remote set-url origin https://github.com/YOUR_USERNAME/lenquant.git

# Verify the change
git remote -v
```

**Option B: Using SSH**

```bash
# For SSH URLs
git remote set-url origin git@github.com:YOUR_USERNAME/lenquant.git

# Verify
git remote -v
```

**Test the Connection:**

```bash
# Fetch to test connection
git fetch origin

# If successful, you should see:
# From https://github.com/YOUR_USERNAME/lenquant
#  * [new branch]      main       -> origin/main
```

---

## Update Team Members

### Step 3: Notify All Collaborators

**Send a message to your team with these instructions:**

```
📢 Repository Renamed: CryptoTrader → LenQuant

The GitHub repository has been renamed. Please update your local clone:

1. Open terminal in your project folder
2. Run: git remote set-url origin https://github.com/YOUR_USERNAME/lenquant.git
3. Run: git fetch origin
4. Verify: git remote -v

New repository URL: https://github.com/YOUR_USERNAME/lenquant

Questions? [Contact person]
```

### Step 4: Update CI/CD and Services

Update any external services that reference your repository:

#### GitHub Actions
- ✅ Usually work automatically with renamed repos
- Check `.github/workflows/*.yml` for any hardcoded URLs
- Update if needed

#### Continuous Integration Services
- **Travis CI**: Update settings if repository URL is hardcoded
- **CircleCI**: May need to re-enable the project
- **Jenkins**: Update job configurations

#### Hosting Services
- **Vercel**: 
  ```bash
  # Re-link the project
  vercel link
  ```
  
- **Netlify**: Update site settings → Build & deploy → Repository

- **Heroku**:
  ```bash
  heroku git:remote -a your-app-name
  ```

#### Docker Hub
- Update automated build settings
- Repository links in Docker Hub settings

#### Package Registries
- **npm**: Update `repository` field in `package.json`
  ```json
  {
    "repository": {
      "type": "git",
      "url": "https://github.com/YOUR_USERNAME/lenquant.git"
    }
  }
  ```

- **PyPI**: Update `project_urls` in `setup.py` or `pyproject.toml`

---

## Update Documentation

### Step 5: Update Repository URLs in Code

Search and replace old repository URLs in your codebase:

```bash
# Search for old URLs (replace OLD_REPO_NAME with your old name)
grep -r "github.com/YOUR_USERNAME/OLD_REPO_NAME" .

# Common files to check:
# - README.md (already updated)
# - package.json (already updated)
# - setup.py or pyproject.toml
# - docs/**/*.md (already updated)
# - .github/workflows/*.yml
# - docker-compose.yml
# - Dockerfile
```

**Files that typically need updating:**

1. **README.md** ✅ (Already updated)
2. **package.json** ✅ (Already updated)
3. **Documentation** ✅ (Already updated)
4. **Contributing guidelines** (if you have `CONTRIBUTING.md`)
5. **GitHub Actions workflows** (check `.github/workflows/`)
6. **Issue templates** (check `.github/ISSUE_TEMPLATE/`)
7. **Pull request templates** (check `.github/PULL_REQUEST_TEMPLATE.md`)

### Step 6: Update External Documentation

- **Wiki pages**: Update GitHub Wiki if you use it
- **GitHub Pages**: Update if you host documentation there
- **Blog posts**: Update any blog posts that reference the repository
- **Social media**: Update pinned tweets, LinkedIn posts, etc.
- **Portfolio**: Update your portfolio website

---

## Verification

### Step 7: Verify Everything Works

**Check Local Repository:**

```bash
# Verify remote URL
git remote -v
# Should show: https://github.com/YOUR_USERNAME/lenquant.git

# Test push access
git push origin main

# Test pull access
git pull origin main
```

**Check GitHub Features:**

- ✅ Issues: Verify old issue links redirect properly
- ✅ Pull Requests: Check old PR links work
- ✅ Releases: Confirm release downloads work
- ✅ GitHub Actions: Check workflows still run
- ✅ Webhooks: Verify webhooks are still triggered

**Check External Services:**

- ✅ CI/CD pipelines run successfully
- ✅ Deployments work from the new repository
- ✅ Package registries show correct repository link
- ✅ Documentation sites build correctly

**Test Clone from Scratch:**

```bash
# Clone with new URL
git clone https://github.com/YOUR_USERNAME/lenquant.git
cd lenquant

# Verify it works
ls -la
```

---

## Important Notes

### GitHub Redirects

- GitHub automatically redirects `OLD_NAME` → `lenquant`
- **These redirects are NOT permanent**
- If someone creates a repo with your old name, redirects stop working
- **Update all URLs as soon as possible**

### Breaking Changes

**These will NOT work after rename:**

- Hardcoded URLs in scripts
- Submodules pointing to old URL
- CI/CD configurations with old URL
- Docker image tags with old repo name
- Package names that include old repo name

**These WILL work automatically:**

- GitHub Pages (username.github.io/OLD_NAME redirects)
- Issue references (#123)
- Pull request references (#456)
- Commit SHAs
- Tags and releases

### Submodules

If this repository is used as a submodule elsewhere:

```bash
# In the parent repository
cd /path/to/parent-repo

# Update submodule URL
git config --file=.gitmodules submodule.PATH.url https://github.com/YOUR_USERNAME/lenquant.git

# Sync and update
git submodule sync
git submodule update --remote
```

### Cloned Forks

If others have forked your repository:

- Their forks will still point to the old name
- They need to update their remotes:
  ```bash
  git remote set-url upstream https://github.com/YOUR_USERNAME/lenquant.git
  ```

---

## Rollback Plan

If something goes wrong, you can rename back:

1. Go to GitHub Settings
2. Rename repository back to old name
3. Update all remote URLs again
4. Notify team

**Note**: It's better to fix issues than to rollback, as rollback causes more confusion.

---

## Quick Reference Card

### Essential Commands

```bash
# Update remote URL
git remote set-url origin https://github.com/YOUR_USERNAME/lenquant.git

# Verify remote URL
git remote -v

# Test connection
git fetch origin

# Update and push
git pull origin main
git push origin main
```

### New Repository URLs

- **HTTPS**: `https://github.com/YOUR_USERNAME/lenquant.git`
- **SSH**: `git@github.com:YOUR_USERNAME/lenquant.git`
- **Web**: `https://github.com/YOUR_USERNAME/lenquant`

### Support

If you encounter issues:

1. Check GitHub's redirect is working: visit old URL, should redirect
2. Verify you have the correct new URL
3. Ensure you have push permissions
4. Check GitHub status page: https://www.githubstatus.com
5. Contact GitHub Support if redirects aren't working

---

## Checklist

Use this checklist to ensure you've updated everything:

### On GitHub
- [ ] Repository renamed on GitHub
- [ ] Repository description updated (if needed)
- [ ] Repository topics updated (if any)

### Local Setup
- [ ] Local remote URL updated
- [ ] Tested git fetch
- [ ] Tested git push
- [ ] Tested git pull

### Team
- [ ] All team members notified
- [ ] Instructions sent to collaborators
- [ ] Verified team members can access

### Services
- [ ] CI/CD services updated
- [ ] Hosting services updated
- [ ] Docker Hub updated
- [ ] Package registries updated
- [ ] Monitoring services updated
- [ ] Any webhooks updated

### Documentation
- [ ] README.md updated ✅
- [ ] Documentation files updated ✅
- [ ] Wiki updated (if applicable)
- [ ] External blog posts updated
- [ ] Portfolio/website updated

### Verification
- [ ] Can clone from new URL
- [ ] Can push to new URL
- [ ] CI/CD runs successfully
- [ ] Deployments work
- [ ] Old URLs redirect properly

---

**🎉 Congratulations! Your repository has been successfully renamed to LenQuant.**

For questions or issues, refer to:
- [GitHub Documentation - Renaming a Repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)
- [Git Documentation - Working with Remotes](https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes)

