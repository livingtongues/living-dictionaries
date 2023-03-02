# About

This script was created to help converting Standard Format Markers (SFM) files coming from Shoebox, Toolbox or FLEx linguistic softwares into a CSV format which is more used nowadays and it's also the way we can do a batch import from a spreadsheet to our Living Dictionaries database.

# Usage

The script was created with Python 3.10.2 and we encorage you to use a virtual environment before run it.

1. Go to packages/python-scripts/convert_sfm_to_csv.

2. (RECOMMENDED) The simple option is to use `venv` which is the native library to create a virtual environment. You can easily do that typing in your terminal:
   `python -m venv myenv` myenv should be the name of your choice, so you can change it.
   then activate it typing: `source myenv/lib/activate`, or if you're using a windows terminal `myenv\Scripts\activate`. On Windows but using git bash should be `source myenv/Scripts/activate`

3. After set your virtual environment and having activated it, you can install all the required libraries with `pip install -r requirements.txt`

Now you're able to run the python script typing `python main.py`.

# Developer Information

To run tests just type `pytest -vv`

- I'm using type hints to easily understand what a function is asking and what is returning.
- I'm also trying to simplify code by extracting functions and that these only do one thing.
- Some functions are not pure functions but I leave them that way when they only rename the elements.

<!-- ## Prepare for export:

1. create string per \\lx (using split)
2. ~~replace spaces for commas~~ use an editable separator
3. create set of headers

## Export to CSV:

4. set headers (array)
5. create an array of python dictionaries
6. create the correct CSV file -->
