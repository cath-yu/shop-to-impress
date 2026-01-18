// CSS 
import "./CheckboxList.css";

export default function CheckboxList({data, selected, onItemSelect}) {
    
    // Selecting/deselecting an item
    const handleSelect = (event) => {
        onItemSelect(event.target.value, event.target.checked);
    }   

    return (
        <div className="checkbox-list">
            {data.map((option, index) => {
                return (
                    <div className="checkbox-options" key={index}>
                        <label className="checkbox-container">{option}
                        <input 
                            type="checkbox"
                            value={option}
                            checked={selected.includes(option)}
                            disabled={!selected.includes(option) && selected.length > 2}
                            onChange={(handleSelect)}
                        />
                        <span className="checkbox"></span>
                        </label>
                    </div>
                )
            })}
        </div>
    )
}