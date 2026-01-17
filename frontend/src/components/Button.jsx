import "./Button.css";

export default function Button({children, style, disabled, onClick}) {
    return (
        <button 
            className={`button ${style}`} 
            type="button" 
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    )
}