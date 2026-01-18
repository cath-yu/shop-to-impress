import "./ProductCard.css";

import Heart from '../assets/heart.svg'

export default function ProductCard({name, price, store, image, side, onClick}) {
    return (
        <div className="product-card">
            <img className="product-card-image" src={image}></img>
            
            <div className="product-card-text">
                <h3>{name}</h3>
                <h3>${price}</h3>
            </div>

            <div className="product-card-store">
                <h4>{store}</h4>
            </div>

            <div className={`product-card-heart-${side}`}>
                <img className="product-card-heart" src={Heart} onClick={() => onClick(side)}></img>
            </div>
        </div>
    )
}